/***********************************************************
 * HWSD Soil Constraints Module (FINAL SAFE VERSION)
 ***********************************************************/

var roi_boundary = null;
var activeMaps = [Map];
var loadedImage = null;
var keepRestorationMarkerOnTopFn = null;

/***********************************************************
 * CLASS DEFINITIONS
 ***********************************************************/
var SOIL_CLASSES = {

  texture: {
    title: 'Topsoil Texture',
    band: 'Topsoil_Texture',
    values: {
      1: 'Clay (heavy)',
      2: 'Silt clay',
      3: 'Clay (light)',
      4: 'Silty clay loam',
      5: 'Clay loam',
      6: 'Silt',
      7: 'Silt loam',
      8: 'Sandy clay',
      9: 'Loam',
      10: 'Sandy clay loam',
      11: 'Sandy loam',
      12: 'Loamy sand',
      13: 'Sand'
    },
    // palette: ['brown', 'orange', 'yellow']
  },

  drainage: {
    title: 'Soil Drainage',
    band: 'Soil_Drainage',
    values: {
      1: 'Excessively drained',
      2: 'Somewhat excessively drained',
      3: 'Well drained',
      4: 'Moderately well drained',
      5: 'Imperfectly drained',
      6: 'Poorly drained'
    },
    // palette: ['red', 'yellow', 'green', 'blue']
  },

  ph: {
    title: 'Topsoil pH',
    band: 'Topsoil_pH_Class',
    values: {
      1: 'Strongly Acidic',
      2: 'Moderately Acidic–Neutral',
      3: 'Slightly Alkaline',
      4: 'Moderately Alkaline'
    },
    // palette: ['red', 'orange', 'yellow', 'green']
  }
};

/***********************************************************
 * ASSETS
 ***********************************************************/
var hwsdRaster = ee.Image('projects/ee-ojasvibansal/assets/hwsd_v1_2').select('b1');
var hwsd2Raster = ee.Image('projects/sat-io/open-datasets/FAO/HWSD_V2_SMU');
var hwsdData   = ee.FeatureCollection('projects/ee-ojasvibansal/assets/hwsd_data');
// lookup tables
var textureTable = ee.FeatureCollection('projects/ee-ojasvibansal/assets/HWSD2_TEXTURE_USDA');
var drainageTable = ee.FeatureCollection('projects/ee-ojasvibansal/assets/HWSD2_DRAINAGE');

/***********************************************************
 * INTERNAL STATE
 ***********************************************************/
var soilUtils = {
  layers: [],
  checkboxes: {}
};

/***********************************************************
 * SET ROI
 ***********************************************************/
exports.setROI = function(roi, mapInstance) {
  roi_boundary = roi;
  if (mapInstance && activeMaps.indexOf(mapInstance) === -1) {
    activeMaps.push(mapInstance);
  }
};

exports.setKeepMarkerOnTop = function(fn) {
  keepRestorationMarkerOnTopFn = fn;
};

// ==================== Soil sample at point ====================
exports.getSoilAtPoint = function(point) {
  if (!point) return null;

  // Build full soil stack (texture + drainage + pH)
  var soilStack = buildSoilStack();

  return soilStack.reduceRegion({
    reducer: ee.Reducer.first(),
    geometry: point,
    scale: 250,        // HWSD native resolution
    maxPixels: 1e8
  });
};


exports.tickCheckboxForValue = function(category, value) {
  if (
    soilUtils.checkboxes[category] &&
    soilUtils.checkboxes[category][value]
  ) {
    soilUtils.checkboxes[category][value].setValue(true);
  }
};


/***********************************************************
 * CLEAR MAP
 ***********************************************************/
function clearMap() {
  activeMaps.forEach(function(m) {
    m.layers().forEach(function(l) {
      if (l.getName() && l.getName().indexOf('Soil') === 0) {
        m.remove(l);
      }
    });
  });
  soilUtils.layers = [];
  loadedImage = null;
}
exports.clearMap = clearMap;

/***********************************************************
 * PANEL
 ***********************************************************/
exports.getPanel = function() {

  var panel = ui.Panel();

  panel.add(ui.Label({
    value: 'Soil Constraints (HWSD)',
    style: {fontSize: '16px', fontWeight: 'bold'}
  }));

  Object.keys(SOIL_CLASSES).forEach(function(key) {
    var cfg = SOIL_CLASSES[key];

    panel.add(ui.Label({
      value: cfg.title,
      style: {fontWeight: 'bold', margin: '8px 0 4px 0'}
    }));

    soilUtils.checkboxes[key] = {};

    Object.keys(cfg.values).forEach(function(v) {
      var cb = ui.Checkbox(cfg.values[v], false);
      soilUtils.checkboxes[key][v] = cb;
      panel.add(cb);
    });
  });

  var loadBtn  = ui.Button({
    label: 'Load',
    onClick: loadSoil,
    style: {stretch: 'horizontal'}
  });
  
  var clearBtn = ui.Button({
    label: 'Clear Map',
    onClick: clearMap,
    style: {stretch: 'horizontal'}
  });
  
  // Horizontal container
  var btnRow = ui.Panel({
    widgets: [loadBtn, clearBtn],
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {stretch: 'horizontal', margin: '8px 0'}
  });
  
  panel.add(btnRow);

  return panel;
};

/***********************************************************
 * BUILD SOIL STACK
 ***********************************************************/
function buildSoilStack() {

  var IDS = ee.List(hwsdData.aggregate_array('ID'));

  // SERVER-SIDE dictionaries
  // var textureDict = ee.Dictionary({
  //   'Fine': 1,
  //   'Medium': 2,
  //   'Coarse': 3
  // });

  // var drainageDict = ee.Dictionary({
  //   'Moderately Well': 1,
  //   'Well': 2,
  //   'Somewhat Excessive': 4,
  //   'Excessive': 4,
  //   'Poor': 3,
  //   'Very Poor': 3
  // });
  
  function fcToDict(fc, keyField, valueField) {
    var keys = ee.List(fc.aggregate_array(keyField));    // server-side list
    var values = ee.List(fc.aggregate_array(valueField)); // server-side list
    return ee.Dictionary.fromLists(keys, values);
  }
  
  // Texture dictionary: keys = VALUE, values = CODE
  var textureDict = fcToDict(textureTable, 'VALUE', 'CODE');
  // Drainage dictionary: keys = VALUE, values = CODE
  var drainageDict = fcToDict(drainageTable, 'VALUE', 'CODE');
  

  /**************** TEXTURE ****************/
  // var textureClasses = hwsdData.map(function (f) {
  //   // Force empty/null textures to a safe placeholder
  //   var texRaw = ee.String(
  //     ee.Algorithms.If(
  //       f.get('T_TEXTURE'),
  //       f.get('T_TEXTURE'),
  //       'UNKNOWN'
  //     )
  //   );
  //   var cls = ee.Number(
  //     textureDict.get(texRaw, 0)
  //   );
  //   return ee.Feature(null, {cls: cls});
  // }).aggregate_array('cls');
  
  // var texture = hwsdRaster
  //   .remap(IDS, textureClasses, 0)
  //   .rename('Topsoil_Texture');
  
  var texture = hwsd2Raster
                .select('TEXTURE_USDA')
                .rename('Topsoil_Texture');


  /**************** DRAINAGE ****************/
  // var drainageClasses = hwsdData.map(function (f) {

  //   var drRaw = f.get('DRAINAGE');

  //   var cls = ee.Algorithms.If(
  //     drRaw,
  //     ee.Number(drainageDict.get(ee.String(drRaw), 3)),
  //     3
  //   );

  //   return ee.Feature(null, {cls: cls});
  // }).aggregate_array('cls');

  // var drainage = hwsdRaster
  //   .remap(IDS, drainageClasses, 3)
  //   .rename('Soil_Drainage');
  
  var drainage = hwsd2Raster
                  .select('DRAINAGE')
                  .rename('Soil_Drainage');
  

  /**************** pH (already correct) ****************/
  var phClasses = hwsdData.map(function (f) {

    var p = f.get('T_PH_H2O');

    var cls = ee.Algorithms.If(
      p,
      ee.Algorithms.If(
        ee.Number(p).gte(4.6).and(ee.Number(p).lt(5.5)), 1,
        ee.Algorithms.If(
          ee.Number(p).gte(5.5).and(ee.Number(p).lt(7.2)), 2,
          ee.Algorithms.If(
            ee.Number(p).gte(7.2).and(ee.Number(p).lt(7.4)), 3,
            ee.Algorithms.If(
              ee.Number(p).gte(7.4).and(ee.Number(p).lte(7.6)), 4,
              0
            )
          )
        )
      ),
      0
    );

    return ee.Feature(null, {cls: cls});
  }).aggregate_array('cls');

  var ph = hwsdRaster
    .remap(IDS, phClasses, 0)
    .rename('Topsoil_pH_Class');

  return ee.Image.cat([texture, drainage, ph]);
}



/***********************************************************
 * LOAD SOIL (SAFE)
 ***********************************************************/
function loadSoil() {
  if (!roi_boundary) { 
    print('⚠️ Set ROI first'); 
    return; 
  }

  clearMap();
  var soilStack = buildSoilStack().clip(roi_boundary);
  var masks = [];

  Object.keys(SOIL_CLASSES).forEach(function(key) {
    var cfg = SOIL_CLASSES[key];
    var selected = [];

    Object.keys(soilUtils.checkboxes[key]).forEach(function(v) {
      if (soilUtils.checkboxes[key][v].getValue()) selected.push(parseInt(v, 10));
    });

    if (selected.length > 0) {
      var band = soilStack.select(cfg.band);
      if (band) {
        // var mask = band.remap(selected, ee.List.repeat(1, selected.length), 0).selfMask();
        var mask = ee.ImageCollection(
              ee.List(selected)
                .map(function(v){
                  return band.eq(ee.Number(v));
                })
            )
            .reduce(ee.Reducer.anyNonZero())
            .selfMask();
            
        if (mask) masks.push(mask);
      }
    }
  });

  if (masks.length > 0) {
    loadedImage = masks.reduce(function(a,b){ return a.and(b); });
    if (loadedImage) {
      activeMaps.forEach(function(m){
        m.addLayer(loadedImage.selfMask(), {palette:['#6D4C41']}, 'Soil');
      });
    } else {
      print('⚠️ No mask could be created for selected soil properties.');
    }
  } else {
    print('⚠️ No soil checkboxes selected or bands are null.');
  }
}

/***********************************************************
 * EXPORTS
 ***********************************************************/
exports.getLoadedImage = function() {
  return loadedImage;
};

exports.getRule = function() {
  var rule = {};
  Object.keys(SOIL_CLASSES).forEach(function(key) {
    var selected = [];
    Object.keys(soilUtils.checkboxes[key]).forEach(function(v) {
      if (soilUtils.checkboxes[key][v].getValue()) selected.push(SOIL_CLASSES[key].values[v]);
    });
    if (selected.length > 0) rule[SOIL_CLASSES[key].title] = selected;
  });
  return Object.keys(rule).length ? rule : null;
};



exports.setValues = function(soilRules) {
  if (!soilRules) return;

  // 1️⃣ Clear existing selections
  Object.keys(soilUtils.checkboxes).forEach(function(cat) {
    Object.keys(soilUtils.checkboxes[cat]).forEach(function(v) {
      soilUtils.checkboxes[cat][v].setValue(false);
    });
  });

  // 2️⃣ Apply JSON rules
  Object.keys(soilRules).forEach(function(title) {

    // 🔴 GEE does NOT support Array.find → manual search
    var classKey = null;

    Object.keys(SOIL_CLASSES).forEach(function(k) {
      if (SOIL_CLASSES[k].title === title) {
        classKey = k;
      }
    });

    if (!classKey) {
      print('⚠️ Unknown soil rule title:', title);
      return;
    }

    var valuesToTick = soilRules[title]; // array of strings

    Object.keys(SOIL_CLASSES[classKey].values).forEach(function(code) {
      var label = SOIL_CLASSES[classKey].values[code];
      if (valuesToTick.indexOf(label) !== -1) {
        soilUtils.checkboxes[classKey][code].setValue(true);
      }
    });
  });

  // 3️⃣ Reload soil layer
  loadSoil();
};
