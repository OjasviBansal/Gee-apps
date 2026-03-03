var roi_boundary = null;
var loadedImage = null;
var activeMaps = [Map];
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

exports.setKeepMarkerOnTop = function(fn) {
  keepRestorationMarkerOnTopFn = fn;
};

// ==================== Bioclim Annual Mean Temperature ====================

var tempUtils = {
  layer: null,
  legends: []
};

// --- Clear function ---
var clearMap = function() {
  activeMaps.forEach(function(m) {
    m.layers().forEach(function(layer) {
      if (layer.getName() &&
          layer.getName().indexOf('Temperature') === 0) {
        m.remove(layer);
      }
    });
  });

  tempUtils.legends.forEach(function(l) {
    activeMaps.forEach(function(m) { m.remove(l); });
  });

  tempUtils.legends = [];
  tempUtils.layer = null;
  loadedImage = null;
};

exports.getPanel = function() {

  var panel = ui.Panel();

  var sectionTitle = ui.Label({
    value: 'Annual Mean Temperature (WorldClim)',
    style: {'fontSize': '16px', 'fontWeight': 'bold', 'margin': '15px 0 5px 10px'}
  });
  panel.add(sectionTitle);

  panel.add(ui.Label({
    value: 'Provide temperature range in °C.',
    style: {'fontSize': '14px'}
  }));

  var controlPanel = ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {margin: '10px 0', padding: '0 10px'}
  });

  panel.add(controlPanel);

  // --- Textboxes ---
  minBox = ui.Textbox({
    placeholder: 'Min',
    value: '',
    style: {width: '120px', margin: '0 5px 0 0'}
  });

  maxBox = ui.Textbox({
    placeholder: 'Max',
    value: '',
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

  // --- Load function ---
  var loadTemperature = function() {

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

    // WorldClim BIO01 (Annual Mean Temperature)
    var dataset = ee.Image('WORLDCLIM/V1/BIO');

    // IMPORTANT: bio01 has scale factor 0.1 → convert to °C
    var bio01 = dataset.select('bio01')
                       .multiply(0.1)
                       .clip(roi_boundary);

    // Binary mask
    var masked = bio01.gte(minVal)
                      .and(bio01.lte(maxVal))
                      .selfMask();

    activeMaps.forEach(function(m) {

      tempUtils.layer = m.addLayer(
        masked,
        {palette: ['ff00ff']},
        'Temperature'
      );

      // Legend
      var legend = ui.Panel({
        style: {position: 'bottom-left', padding: '8px 15px', backgroundColor: 'white'}
      });

      legend.add(ui.Label({
        value: 'Temperature Range',
        style: {fontWeight: 'bold', fontSize: '16px', margin: '0 0 4px 0'}
      }));

      legend.add(ui.Panel({
        widgets: [
          ui.Label({style: {backgroundColor: 'red', padding: '8px', border: '1px solid black'}}),
          ui.Label({value: minVal + '–' + maxVal + ' °C', style: {margin: '0 0 0 6px'}})
        ],
        layout: ui.Panel.Layout.flow('horizontal')
      }));

      tempUtils.legends.push(legend);
    });

    loadedImage = masked;

    if (keepRestorationMarkerOnTopFn) {
      ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
    }
  };

  loadButton.onClick(loadTemperature);
  clearButton.onClick(clearMap);

  return panel;
};

// ----------------- Exposed Functions -----------------

exports.getLoadedImage = function() {
  if (!roi_boundary) return null;

  var minVal = parseFloat(minBox.getValue());
  var maxVal = parseFloat(maxBox.getValue());

  if (isNaN(minVal) || isNaN(maxVal) || minVal > maxVal) return null;

  var dataset = ee.Image('WORLDCLIM/V1/BIO');

  var bio01 = dataset.select('bio01')
                     .multiply(0.1)
                     .clip(roi_boundary);

  loadedImage = bio01.gte(minVal)
                     .and(bio01.lte(maxVal))
                     .selfMask();

  return loadedImage;
};

exports.setRange = function(minVal, maxVal) {
  if (minBox && maxBox) {
    minBox.setValue(minVal);
    maxBox.setValue(maxVal);
  }
};

exports.clearMap = clearMap;

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