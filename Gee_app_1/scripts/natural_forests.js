var roi_boundary = null;
var mapInstance = null;
var loadedImage = null;
var nfLayer = null;
var keepRestorationMarkerOnTopFn = null;

var probabilities = ee.ImageCollection(
  'projects/nature-trace/assets/forest_typology/natural_forest_2020_v1_0_collection'
).mosaic().select('B0'); 
exports.setROI = function(roi, map) {
  roi_boundary = roi;
  mapInstance = map;
};
exports.getLoadedImage = function() {
  return loadedImage;
};
exports.getPanel = function() {

  var panel = ui.Panel();

  panel.add(ui.Label({
    value: 'Natural Forests (Global 2020)',
    style: {fontSize: '16px', fontWeight: 'bold', margin: '10px 0 5px 10px'}
  }));

  panel.add(ui.Label({
    value: 'Probability map of natural forests (10m). Apply threshold* to create mask.',
    style: {fontSize: '14px'}
  }));
  panel.add(ui.Label({
    value: '*Threshold sets the minimum probability required to classify a pixel as Natural Forest. Higher values give stricter, more confident forest mapping.',
    style: {fontSize: '14px'}
  }));

  // Threshold input
  var thresholdBox = ui.Textbox({
    placeholder: 'Threshold (0–250)',
    value: '125',   // 0.5 probability ≈ 125 (scaled 0–250)
    style: {width: '100px'}
  });

  panel.add(ui.Label('Threshold (0–250):'));
  panel.add(thresholdBox);

  // Buttons
  var loadButton = ui.Button({
    label: 'Load',
    style: {margin: '5px 5px 5px 0'}
  });

  var clearButton = ui.Button({
    label: 'Clear',
    style: {margin: '5px 0 5px 0'}
  });

  panel.add(ui.Panel([loadButton, clearButton], ui.Panel.Layout.flow('horizontal')));

  // ----------------------------------------------
  // Clear function
  // ----------------------------------------------

  var clearLayer = function() {
    if (!mapInstance) return;

    if (nfLayer) {
      mapInstance.layers().remove(nfLayer);
      nfLayer = null;
    }

    loadedImage = null;
  };

  // ----------------------------------------------
  // Load function
  // ----------------------------------------------

  var loadLayer = function() {

    if (!mapInstance) {
      print('Map not initialized');
      return;
    }

    clearLayer();

    var threshold = parseFloat(thresholdBox.getValue());

    if (isNaN(threshold)) {
      print('Invalid threshold value');
      return;
    }

    var img = probabilities;

    if (roi_boundary) {
      img = img.clip(roi_boundary);
    }

    // Create binary mask
    var mask = img.gte(threshold).selfMask();

    loadedImage = mask;

    nfLayer = mapInstance.addLayer(
      mask,
      {palette: ['teal']},
      'Natural Forest (threshold)'
    );

    if (keepRestorationMarkerOnTopFn) {
      ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
    }
  };

  loadButton.onClick(loadLayer);
  clearButton.onClick(clearLayer);

  return panel;
};

// ----------------------------------------------
// Restore from JSON rules
// ----------------------------------------------

exports.setValues = function(thresholdValue, map) {

  var mapToUse = map || mapInstance;

  if (!thresholdValue) return;
  if (!mapToUse) return;

  var img = probabilities;

  if (roi_boundary) {
    img = img.clip(roi_boundary);
  }

  var mask = img.gte(thresholdValue).selfMask();
  loadedImage = mask;

  if (nfLayer) {
    mapToUse.layers().remove(nfLayer);
  }

  nfLayer = mapToUse.addLayer(
    mask,
    {palette: ['teal']},
    'Natural Forest (threshold)'
  );
};

// ----------------------------------------------
// Marker layering helper
// ----------------------------------------------

exports.setKeepMarkerOnTop = function(fn) {
  keepRestorationMarkerOnTopFn = fn;
};