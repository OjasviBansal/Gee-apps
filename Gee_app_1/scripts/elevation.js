var roi_boundary = null;
var loadedImage = null;
var activeMaps = [Map]; // default to the global Map
var keepRestorationMarkerOnTopFn = null;
// Track UI elements
var minBox, maxBox;

// Allow ROI + map registration
exports.setROI = function(roi, mapInstance) {
  roi_boundary = roi;
  if (mapInstance && activeMaps.indexOf(mapInstance) === -1) {
    activeMaps.push(mapInstance);
  }
};

// ==================== Elevation ====================

// Namespace for layer 
var elevationUtils = {
  layer: null
};

exports.getPanel = function() {
  var panel = ui.Panel();
  
  var sectionTitle = ui.Label({
    value: 'Elevation',
    style: {'fontSize': '16px', 'fontWeight': 'bold', 'margin': '15px 0 5px 10px'}
  });
  panel.add(sectionTitle);
  
  panel.add(ui.Label({
    value: 'Provide a range corresponding to the area.',
    style: {'fontSize': '14px'}
  }));

  var controlPanel = ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {margin: '10px 0', padding: '0 10px'}
  });
  panel.add(controlPanel);

  // --- Textboxes ---
  minBox = ui.Textbox({
    placeholder: 'Min elevation (m)',
    value: '0',
    style: {width: '120px', margin: '0 5px 0 0'}
  });

  maxBox = ui.Textbox({
    placeholder: 'Max elevation (m)',
    value: '3000',
    style: {width: '120px', margin: '0 10px 0 0'}
  });

  // --- Buttons ---
  var loadButton = ui.Button({
    label: 'Load',
    style: {margin: '0 5px 0 0', height: '30px'}
  });

  var clearButton = ui.Button({
    label: 'Clear Map',
    style: {margin: '0', height: '30px'}
  });

  controlPanel.add(minBox);
  controlPanel.add(maxBox);
  controlPanel.add(loadButton);
  controlPanel.add(clearButton);

  // --- Clear function ---
  var clearMap = function() {
    activeMaps.forEach(function(m) {
      m.layers().forEach(function(layer) {
        if (layer.getName() && layer.getName().indexOf('Elevation') === 0) {
          m.remove(layer);
        }
      });
    });
    elevationUtils.layer = null;
    loadedImage = null;
  };

  // --- Load function ---
  var loadElevation = function() {
    if (!roi_boundary) {
      print('⚠️ Error: Please set ROI from the main panel first.');
      return;
    }

    var minVal = parseFloat(minBox.getValue());
    var maxVal = parseFloat(maxBox.getValue());

    if (isNaN(minVal) || isNaN(maxVal) || minVal > maxVal) {
      print('⚠️ Error: Please enter valid min/max values');
      return;
    }

    clearMap();

    // SRTM elevation data
    var dataset = ee.Image('USGS/SRTMGL1_003');
    var elevation = dataset.clip(roi_boundary);

    // Binary mask: 1 where within range
    var masked = elevation.gte(minVal).and(elevation.lte(maxVal)).selfMask();

    activeMaps.forEach(function(m) {
      elevationUtils.layer = m.addLayer(
        masked,
        {palette: ['#5A2E0C']},
        'Elevation (' + minVal + '–' + maxVal + ' m)'
      );

    });

    loadedImage = masked;
    if (keepRestorationMarkerOnTopFn) {
      ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
    }
  };

  loadButton.onClick(loadElevation);
  clearButton.onClick(clearMap);

  return panel;
};

// ----------------- Exposed functions -----------------
exports.getLoadedImage = function() {
  return loadedImage;
};

// ----------------- New setter function -----------------
exports.setRange = function(minVal, maxVal) {
  if (minBox && maxBox) {
    minBox.setValue(minVal);
    maxBox.setValue(maxVal);
  } else {
    print('⚠️ Error: Elevation textboxes not initialized yet.');
  }
};
exports.setKeepMarkerOnTop = function(fn) {
  keepRestorationMarkerOnTopFn = fn;
};


exports.getRule = function () {
  if (!roi_boundary) return null;

  var minVal = parseFloat(minBox.getValue());
  var maxVal = parseFloat(maxBox.getValue());

  if (isNaN(minVal) || isNaN(maxVal) || minVal > maxVal) {
    return null;
  }

  // Standard numeric-range rule
  return {
    min: minVal,
    max: maxVal
  };
};


// ----------------- Apply from JSON (AUTO LOAD) -----------------
exports.applyFromJSON = function (minVal, maxVal) {
  if (!roi_boundary) {
    print('⚠️ Elevation ROI not set');
    return;
  }

  // Update UI boxes
  if (minBox && maxBox) {
    minBox.setValue(minVal);
    maxBox.setValue(maxVal);
  }

  minVal = parseFloat(minVal);
  maxVal = parseFloat(maxVal);

  if (isNaN(minVal) || isNaN(maxVal) || minVal > maxVal) {
    print('⚠️ Invalid elevation range from JSON');
    return;
  }

  // Clear existing elevation layers
  activeMaps.forEach(function (m) {
    m.layers().forEach(function (layer) {
      if (layer.getName() &&
          layer.getName().indexOf('Elevation') === 0) {
        m.remove(layer);
      }
    });
  });

  // SRTM elevation data
  var dataset = ee.Image('USGS/SRTMGL1_003');
  var elevation = dataset.clip(roi_boundary);

  // Binary mask
  var masked = elevation
    .gte(minVal)
    .and(elevation.lte(maxVal))
    .selfMask();

  activeMaps.forEach(function (m) {
    elevationUtils.layer = m.addLayer(
      masked,
      { palette: ['#5A2E0C'] },
      'Elevation (' + minVal + '–' + maxVal + ' m)'
    );
  });

  loadedImage = masked;

  if (keepRestorationMarkerOnTopFn) {
    ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
  }
};

