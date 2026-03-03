var roi_boundary = null;
var loadedImage = null;
var currentMap = null; // default to the global Map
var activeMaps = [null];
var keepRestorationMarkerOnTopFn = null;
// Track UI elements
var minBox, maxBox;

// Allow ROI + map registration
exports.setROI = function(roi, mapInstance) {
  roi_boundary = roi;
  if (mapInstance && activeMaps.indexOf(mapInstance) === -1) {
    currentMap = mapInstance;
    activeMaps.push(mapInstance);
  }
};


// ==================== Bioclim Annual Precipitation ====================

// Namespace for layer and legend
var bioclimUtils = {
  layer: null,
};

exports.getPanel = function() {
  var panel = ui.Panel();
  
  var sectionTitle = ui.Label({
    value: 'Annual Precipitation (WorldClim BIO Variables V1)',
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
    placeholder: 'Min precipitation (mm)',
    value: '0',
    style: {width: '120px', margin: '0 5px 0 0'}
  });

  maxBox = ui.Textbox({
    placeholder: 'Max precipitation (mm)',
    value: '4000',
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
  // var clearMap = function() {
  //   if (!currentMap) return;
  
  //   currentMap.layers().forEach(function(layer) {
  //     if (layer.getName() &&
  //         layer.getName().indexOf('Annual Precipitation') === 0) {
  //       currentMap.remove(layer);
  //     }
  //   });
  
  //   bioclimUtils.layer = null;
  //   loadedImage = null;
  // };
  var clearMap = function() {
    activeMaps.forEach(function(m) {
      if (!m) return;
  
      m.layers().forEach(function(layer) {
        if (layer.getName() &&
            layer.getName().indexOf('Annual Precipitation') === 0) {
          m.remove(layer);
        }
      });
    });
  
    bioclimUtils.layer = null;
    loadedImage = null;
  };


  // --- Load function ---
  var loadBioclim = function() {
  if (!roi_boundary || !currentMap) {
    print('⚠️ ROI or target map not set.');
    return;
  }

  var minVal = parseFloat(minBox.getValue());
  var maxVal = parseFloat(maxBox.getValue());

  if (isNaN(minVal) || isNaN(maxVal) || minVal > maxVal) {
    print('⚠️ Invalid rainfall range');
    return;
  }

  clearMap();

  var bio12 = dataset.select('bio12').clip(roi_boundary);
  var masked = bio12.gte(minVal).and(bio12.lte(maxVal)).selfMask();

  // currentMap.addLayer(
  //   masked,
  //   { palette: ['blue'] },
  //   'Annual Precipitation (' + minVal + '–' + maxVal + ' mm)'
  // );
  
  activeMaps.forEach(function(m) {
    if (!m) return;
  
    m.addLayer(
      masked,
      { palette: ['blue'] },
      'Annual Precipitation (' + minVal + '–' + maxVal + ' mm)'
    );
  });

  loadedImage = masked;

  if (keepRestorationMarkerOnTopFn) {
    ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
  }
};


  loadButton.onClick(loadBioclim);
  clearButton.onClick(clearMap);

  return panel;
};

// ----------------- Exposed functions -----------------
exports.getLoadedImage = function() {
  return loadedImage;
};
exports.reloadAndGetImage = function() {
  if (!roi_boundary) return null;

  var minVal = parseFloat(minBox.getValue());
  var maxVal = parseFloat(maxBox.getValue());

  if (isNaN(minVal) || isNaN(maxVal) || minVal > maxVal) {
    print('⚠️ Error: Invalid min/max rainfall range.');
    return null;
  }

  // WorldClim BIO12 (Annual Precipitation, mm)
  var bio12 = dataset.select('bio12').clip(roi_boundary);

  // Binary mask: 1 where within range, 0 elsewhere
  var masked = bio12.gte(minVal).and(bio12.lte(maxVal)).selfMask();

  loadedImage = masked;  // store updated binary mask
  return masked;
};


// ----------------- New setter function -----------------
exports.setRange = function(minVal, maxVal) {
  if (minBox && maxBox) {
    minBox.setValue(minVal);
    maxBox.setValue(maxVal);
  } else {
    print('Error: Rainfall textboxes not initialized yet.');
  }
};
var keepMarkerOnTop = null; // private reference

exports.setKeepMarkerOnTop = function(fn) {
  keepRestorationMarkerOnTopFn = fn;
};

exports.getRule = function() {
  if (!roi_boundary) return null;

  var minVal = parseFloat(minBox.getValue());
  var maxVal = parseFloat(maxBox.getValue());

  if (isNaN(minVal) || isNaN(maxVal) || minVal > maxVal) {
    return null;
  }

  // STANDARD min-max format
  return {
    min: minVal,
    max: maxVal
  };
};


exports.applyFromJSON = function(minVal, maxVal) {
  if (!roi_boundary) {
    print('⚠️ Rainfall ROI not set');
    return;
  }

  if (minBox && maxBox) {
    minBox.setValue(minVal);
    maxBox.setValue(maxVal);
  }

  // 🔑 Trigger actual layer draw
  var loadFn = function() {
    var minV = parseFloat(minVal);
    var maxV = parseFloat(maxVal);

    var bio12 = dataset.select('bio12').clip(roi_boundary);
    var masked = bio12.gte(minV).and(bio12.lte(maxV)).selfMask();

    // Clear old rainfall layers
    // currentMap.forEach(function(m) {
    //   m.layers().forEach(function(layer) {
    //     if (layer.getName() &&
    //         layer.getName().indexOf('Annual Precipitation') === 0) {
    //       m.remove(layer);
    //     }
    //   });
    // });

    // currentMap.forEach(function(m) {
    //   m.addLayer(
    //     masked,
    //     {palette: ['blue']},
    //     'Annual Precipitation (' + minV + '–' + maxV + ' mm)'
    //   );
    // });
    
    activeMaps.forEach(function(m) {
      if (!m) return;
    
      m.layers().forEach(function(layer) {
        if (layer.getName() &&
            layer.getName().indexOf('Annual Precipitation') === 0) {
          m.remove(layer);
        }
      });
    });
    
    activeMaps.forEach(function(m) {
      if (!m) return;
    
      m.addLayer(
        masked,
        { palette: ['blue'] },
        'Annual Precipitation (' + minVal + '–' + maxVal + ' mm)'
      );
    });

    loadedImage = masked;
  };

  loadFn();
};


// ==================== target-only setter ====================
exports.setValues2 = function(minVal, maxVal, targetMap) {
  if (!roi_boundary) {
    print('⚠️ Rainfall ROI not set');
    return;
  }

  if (!targetMap) {
    print('⚠️ No inference map provided');
    return;
  }

  // Update UI boxes (optional, keeps UI consistent)
  if (minBox && maxBox) {
    minBox.setValue(minVal);
    maxBox.setValue(maxVal);
  }

  var minV = parseFloat(minVal);
  var maxV = parseFloat(maxVal);

  if (isNaN(minV) || isNaN(maxV) || minV > maxV) {
    print('⚠️ Invalid rainfall range');
    return;
  }

  // Build image
  var bio12 = dataset.select('bio12').clip(roi_boundary);
  var masked = bio12.gte(minV).and(bio12.lte(maxV)).selfMask();

  // 🔥 CLEAR ONLY inference map
  targetMap.layers().forEach(function(layer) {
    if (layer.getName() &&
        layer.getName().indexOf('Annual Precipitation') === 0) {
      targetMap.remove(layer);
    }
  });

  // 🔥 ADD ONLY inference map
  targetMap.addLayer(
    masked,
    { palette: ['blue'] },
    'Annual Precipitation (' + minV + '–' + maxV + ' mm)'
  );

  loadedImage = masked;
};
