// ==================== Bioclim Annual Mean Temperature ====================

var roi_boundary = null;
var loadedImage = null;
var currentMap = null;
var activeMaps = [null];
var keepRestorationMarkerOnTopFn = null;

// Track UI elements
var minBox, maxBox;

// 🌍 WorldClim dataset
var dataset = ee.Image('WORLDCLIM/V1/BIO');

// Allow ROI + map registration
exports.setROI = function(roi, mapInstance) {
  roi_boundary = roi;
  if (mapInstance && activeMaps.indexOf(mapInstance) === -1) {
    currentMap = mapInstance;
    activeMaps.push(mapInstance);
  }
};

// Namespace
var tempUtils = {
  layer: null,
};

// ==================== UI PANEL ====================
exports.getPanel = function() {
  var panel = ui.Panel();

  var sectionTitle = ui.Label({
    value: 'Annual Mean Temperature (WorldClim BIO01)',
    style: {
      fontSize: '16px',
      fontWeight: 'bold',
      margin: '15px 0 5px 10px'
    }
  });
  panel.add(sectionTitle);

  panel.add(ui.Label({
    value: 'Provide temperature range in °C.',
    style: { fontSize: '14px' }
  }));

  var controlPanel = ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    style: { margin: '10px 0', padding: '0 10px' }
  });

  panel.add(controlPanel);

  // 🌡 Textboxes (START EMPTY — no silent activation)
  minBox = ui.Textbox({
    placeholder: 'Min',
    value: '',
    style: { width: '120px', margin: '0 5px 0 0' }
  });

  maxBox = ui.Textbox({
    placeholder: 'Max',
    value: '',
    style: { width: '120px', margin: '0 10px 0 0' }
  });

  var loadButton = ui.Button({
    label: 'Load',
    style: { margin: '0 5px 0 0', height: '30px' }
  });

  var clearButton = ui.Button({
    label: 'Clear Map',
    style: { margin: '0', height: '30px' }
  });

  controlPanel.add(minBox);
  controlPanel.add(maxBox);
  controlPanel.add(loadButton);
  controlPanel.add(clearButton);

  // ================= CLEAR =================
  // var clearMap = function() {
  //   if (!currentMap) return;

  //   currentMap.layers().forEach(function(layer) {
  //     if (layer.getName() &&
  //         layer.getName().indexOf('Annual Mean Temperature') === 0) {
  //       currentMap.remove(layer);
  //     }
  //   });

  //   tempUtils.layer = null;
  //   loadedImage = null;
  // };
  var clearMap = function() {
    activeMaps.forEach(function(m) {
      if (!m) return;
  
      m.layers().forEach(function(layer) {
        if (layer.getName() &&
            layer.getName().indexOf('Annual Mean Temperature') === 0) {
          m.remove(layer);
        }
      });
    });
  
    tempUtils.layer = null;
    loadedImage = null;
  };

  // ================= LOAD =================
  var loadTemp = function() {
    if (!roi_boundary || !currentMap) {
      print('⚠️ ROI or target map not set.');
      return;
    }

    var minVal = parseFloat(minBox.getValue());
    var maxVal = parseFloat(maxBox.getValue());

    if (isNaN(minVal) || isNaN(maxVal) || minVal > maxVal) {
      print('⚠️ Invalid temperature range');
      return;
    }

    clearMap();

    var bio01 = dataset.select('bio01')
      .divide(10)   // Convert from °C × 10 to °C
      .clip(roi_boundary);

    var masked = bio01.gte(minVal)
      .and(bio01.lte(maxVal))
      .selfMask();

    // currentMap.addLayer(
    //   masked,
    //   { palette: ['#ff00ff'] }, // 🌡 distinct temperature color
    //   'Annual Mean Temperature (' + minVal + '–' + maxVal + ' °C)'
    // );
    activeMaps.forEach(function(m) {
      if (!m) return;
    
      m.addLayer(
        masked,
        { palette: ['#ff00ff'] },
        'Annual Mean Temperature (' + minVal + '–' + maxVal + ' °C)'
      );
    });

    loadedImage = masked;

    if (keepRestorationMarkerOnTopFn) {
      ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
    }
  };

  loadButton.onClick(loadTemp);
  clearButton.onClick(clearMap);

  return panel;
};

// ==================== EXPORTED FUNCTIONS ====================

exports.getLoadedImage = function() {
  return loadedImage;
};

exports.reloadAndGetImage = function() {
  if (!roi_boundary) return null;

  var minVal = parseFloat(minBox.getValue());
  var maxVal = parseFloat(maxBox.getValue());

  if (isNaN(minVal) || isNaN(maxVal) || minVal > maxVal) {
    return null;
  }

  var bio01 = dataset.select('bio01')
    .divide(10)
    .clip(roi_boundary);

  var masked = bio01.gte(minVal)
    .and(bio01.lte(maxVal))
    .selfMask();

  loadedImage = masked;
  return masked;
};


exports.setRange = function(minVal, maxVal) {
  if (minBox && maxBox) {
    minBox.setValue(minVal);
    maxBox.setValue(maxVal);
  } else {
    print('Error: Temp textboxes not initialized yet.');
  }
};
var keepMarkerOnTop = null; // private reference


// Standard rule format (for AND logic)
exports.getRule = function() {
  if (!roi_boundary) return null;

  var minVal = parseFloat(minBox.getValue());
  var maxVal = parseFloat(maxBox.getValue());

  if (isNaN(minVal) || isNaN(maxVal) || minVal > maxVal) {
    return null;
  }

  return {
    min: minVal,
    max: maxVal
  };
};

// JSON apply
exports.applyFromJSON = function(minVal, maxVal) {
  if (!roi_boundary) {
    print('⚠️ Temperature ROI not set');
    return;
  }

  if (minBox && maxBox) {
    minBox.setValue(minVal);
    maxBox.setValue(maxVal);
  }

  var bio01 = dataset.select('bio01')
    .divide(10)
    .clip(roi_boundary);

  var masked = bio01.gte(minVal)
    .and(bio01.lte(maxVal))
    .selfMask();

  // currentMap.addLayer(
  //   masked,
  //   { palette: ['#ff00ff'] },
  //   'Annual Mean Temperature (' + minVal + '–' + maxVal + ' °C)'
  // );
  // 🔥 Clear existing temperature layers
  activeMaps.forEach(function(m) {
    if (!m) return;

    m.layers().forEach(function(layer) {
      if (layer.getName() &&
          layer.getName().indexOf('Annual Mean Temperature') === 0) {
        m.remove(layer);
      }
    });
  });

  // 🔥 Add to all maps
  activeMaps.forEach(function(m) {
    if (!m) return;

    m.addLayer(
      masked,
      { palette: ['#ff00ff'] },
      'Annual Mean Temperature (' + minVal + '–' + maxVal + ' °C)'
    );
  });

  loadedImage = masked;
};

// Target-only setter (for inference map)
exports.setValues2 = function(minVal, maxVal, targetMap) {
  if (!roi_boundary || !targetMap) return;

  var bio01 = dataset.select('bio01')
    .divide(10)
    .clip(roi_boundary);

  var masked = bio01.gte(minVal)
    .and(bio01.lte(maxVal))
    .selfMask();

  targetMap.layers().forEach(function(layer) {
    if (layer.getName() &&
        layer.getName().indexOf('Annual Mean Temperature') === 0) {
      targetMap.remove(layer);
    }
  });

  targetMap.addLayer(
    masked,
    { palette: ['#ff00ff'] },
    'Annual Mean Temperature (' + minVal + '–' + maxVal + ' °C)'
  );

  loadedImage = masked;
};

exports.setKeepMarkerOnTop = function(fn) {
  keepRestorationMarkerOnTopFn = fn;
};