// ==================== GLOBALS ====================
var roi_boundary = null;
var loadedImage = null;
var activeMaps = [];    // track maps where ROI + layers should appear
var alertLabel = ui.Label({
  value: '',
  style: {color: 'red', fontWeight: 'bold', margin: '4px 0 0 0'}
});
var keepRestorationMarkerOnTopFn = null;

// Store year ranges
var years = { validation: { start: null, end: null }, test: { start: null, end: null } };

// Module-level minFiresBox
var minFiresBox = ui.Textbox({ placeholder: 'Min fire occurrences', value: '0' });
exports.minFiresBox = minFiresBox;

// Track last fire layers and legends
var mapLayers = []; // {map: mapInstance, layer: ui.Map.Layer, legend: ui.Panel}

// ==================== ROI registration ====================
exports.setROI = function(roi, mapInstance) {
  roi_boundary = roi;
  if (mapInstance && activeMaps.indexOf(mapInstance) === -1) activeMaps.push(mapInstance);
};

// ==================== Set years ====================
exports.setYears = function(startYear, endYear, mode) {
  if (typeof startYear !== 'number' || typeof endYear !== 'number') throw new Error('Start and end years must be numbers.');
  if (mode !== 'validation' && mode !== 'test') throw new Error('Mode must be either "validation" or "test".');
  years[mode].start = startYear;
  years[mode].end = endYear;
};

// ==================== Count fire occurrences ====================
function count_fire_occurrences(image_collection) {
  return image_collection.map(function(image) {
    return image.select('BurnDate').gt(0).rename('fireMask');
  }).sum();
}

// ==================== Get fire at a clicked point ====================
exports.getFireAtPoint = function(point) {
  var selectedYears = years.validation;
  var startYear = (selectedYears.start != null) ? selectedYears.start : 2001;
  var endYear = (selectedYears.end != null) ? selectedYears.end : 2020;

  var fireCollection = ee.ImageCollection("MODIS/061/MCD64A1")
    .filterDate(ee.Date.fromYMD(startYear, 1, 1),
                ee.Date.fromYMD(endYear, 12, 31));

  var fireCountImage = count_fire_occurrences(fireCollection);

  return fireCountImage.reduceRegion({
    reducer: ee.Reducer.first(),
    geometry: point,
    scale: 500,
    bestEffort: true
  }).get('fireMask');
};

// ==================== Panel ====================
exports.getPanel = function(mode) {
  if (!mode) mode = 'validation';
  var panel = ui.Panel();

  panel.add(ui.Label({
    value: 'Fire Occurrences (MODIS MCD64A1)',
    style: {fontSize: '16px', fontWeight: 'bold', margin: '10px 0 5px 10px'}
  }));

  panel.add(ui.Label({
    value: 'Specify a lower bound (>0) for fire occurrences in the area during the selected period (between the base year and restoration start year).',
    style: {fontSize: '14px'}
  }));

  panel.add(ui.Label('Minimum Fire Occurrences:'));
  panel.add(minFiresBox);
  panel.add(alertLabel);

  var runButton = ui.Button('Show Fire Occurrences');
  var clearButton = ui.Button('Clear Map');
  panel.add(ui.Panel([runButton, clearButton], ui.Panel.Layout.flow('horizontal')));

  // ---- Run handler ----
  runButton.onClick(function() {
    alertLabel.setValue('');
    if (!roi_boundary) { print('Please set ROI first'); return; }

    var selectedYears = (mode === 'validation') ? years.validation : years.test;
    if (!selectedYears.start || !selectedYears.end) {
      alertLabel.setValue('Year range not set! Please set the years first.');
      return;
    }

    var minFires = parseInt(minFiresBox.getValue());
    if (isNaN(minFires) || minFires < 1) { print('Enter valid min fires'); return; }

    var fireCollection = ee.ImageCollection("MODIS/061/MCD64A1")
      .filterDate(ee.Date.fromYMD(selectedYears.start, 1, 1),
                  ee.Date.fromYMD(selectedYears.end, 12, 31))
      .map(function(img) { return img.clip(roi_boundary); });

    var fireCount = count_fire_occurrences(fireCollection).clip(roi_boundary);
    var fireFiltered = fireCount.gte(minFires).selfMask();
    loadedImage = fireFiltered;

    var vis = {palette: ['#ff69b4']};

    activeMaps.forEach(function(mapInstance) {
      // Remove previous layer/legend for this map
      for (var i = mapLayers.length - 1; i >= 0; i--) {
        if (mapLayers[i].map === mapInstance) {
          mapInstance.remove(mapLayers[i].layer);
          mapLayers.splice(i, 1);
        }
      }

      // Add new layer
      if (fireFiltered) {
        var layer = mapInstance.addLayer(fireFiltered, vis,
          'Fire Occurrences ' + selectedYears.start + '-' + selectedYears.end + ' (' + mode + ')');

        // Store reference
        mapLayers.push({map: mapInstance, layer: layer});
        if (keepRestorationMarkerOnTopFn) {
        ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
      }
      }
    });
  });

  // ---- Clear handler ----
  clearButton.onClick(function() {
    for (var i = mapLayers.length - 1; i >= 0; i--) {
      mapLayers[i].map.remove(mapLayers[i].layer);
      // mapLayers[i].map.widgets().remove(mapLayers[i].legend);
      // mapInstance.remove(mapLayers[i].legend);
      mapLayers.splice(i, 1);
    }
    loadedImage = null;
  });

  return panel;
};

// ==================== Loaded image getter ====================
exports.getLoadedImage = function() { return loadedImage; };
exports.setKeepMarkerOnTop = function(fn) {
  keepRestorationMarkerOnTopFn = fn;
};


exports.getRule = function(mode) {
  if (!roi_boundary) return null;

  var selectedYears = (mode === 'validation') ? years.validation : years.test;
  var minFires = parseInt(minFiresBox.getValue());

  if (isNaN(minFires) || minFires <= 0) return null;

  // Return simple JSON
  return minFires;  // just the number of fires
};





exports.setValues = function(minFireCount, mode) {
  if (minFireCount === null || minFireCount === undefined) return;

  if (!roi_boundary) {
    print('⚠️ Fire: ROI not set');
    return;
  }

  if (mode !== 'validation' && mode !== 'test') {
    print('⚠️ Fire: mode must be "validation" or "test"');
    return;
  }

  var selectedYears = years[mode];
  if (!selectedYears.start || !selectedYears.end) {
    print('⚠️ Fire: years not set for mode:', mode);
    return;
  }

  // 1️⃣ Update textbox (UI sync)
  minFiresBox.setValue(String(minFireCount));

  // 2️⃣ Build fire collection
  var fireCollection = ee.ImageCollection("MODIS/061/MCD64A1")
    .filterDate(
      ee.Date.fromYMD(selectedYears.start, 1, 1),
      ee.Date.fromYMD(selectedYears.end, 12, 31)
    )
    .map(function(img) {
      return img.clip(roi_boundary);
    });

  var fireCount = count_fire_occurrences(fireCollection).clip(roi_boundary);
  var fireFiltered = fireCount.gte(minFireCount).selfMask();
  loadedImage = fireFiltered;

  var vis = { palette: ['#ff69b4'] };

  // 3️⃣ Remove old fire layers
  for (var i = mapLayers.length - 1; i >= 0; i--) {
    mapLayers[i].map.remove(mapLayers[i].layer);
    mapLayers.splice(i, 1);
  }

  // 4️⃣ Add new layer to all active maps
  activeMaps.forEach(function(mapInstance) {
    var layer = mapInstance.addLayer(
      fireFiltered,
      vis,
      'Fire Occurrences ' +
        selectedYears.start + '-' +
        selectedYears.end + ' (' + mode + ')'
    );

    mapLayers.push({ map: mapInstance, layer: layer });

    if (keepRestorationMarkerOnTopFn) {
      ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
    }
  });
};
