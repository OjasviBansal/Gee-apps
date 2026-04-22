var roi_boundary = null;
var loadedImage = null;
var keepRestorationMarkerOnTopFn = null;

var selectedYear = null;  // store the year passed from main script
var activeMaps = [Map];
var checkboxes = [];  // global array for LULC checkboxes


var pendingLulcValues = null;


var lulcClasses = [
  {name: 'Built up', value: 1},
  {name: 'Kharif water', value: 2},
  {name: 'Kharif and rabi water', value: 3},
  {name: 'Kharif and rabi and zaid water', value: 4},
  {name: 'Trees', value: 6},
  {name: 'Barren lands', value: 7},
  {name: 'Single Kharif Cropping', value: 8},
  {name: 'Single Non-Kharif Cropping', value: 9},
  {name: 'Double Cropping', value: 10},
  {name: 'Triple Cropping', value: 11},
  {name: 'Shrubs_Scrubs', value: 12}
];

var lulcUtils = { layers: [], legends: [] };

exports.setROI = function(roi, mapInstance, year) {
  roi_boundary = roi;
  // selectedYear = year;
  if (mapInstance && activeMaps.indexOf(mapInstance) === -1) activeMaps.push(mapInstance);
};


exports.setKeepMarkerOnTop = function(fn) {
  keepRestorationMarkerOnTopFn = fn;
};


// exports.setYears = function(startYear, endYear) {
//   if (typeof startYear !== 'number' || typeof endYear !== 'number') throw new Error('Years must be numbers');
//   selectedYear = endYear;  // or however you handle test years
// };

exports.setYears = function(startYear, endYear) {
  if (typeof endYear !== 'number') {
    print('⚠️ Invalid LULC year');
    return;
  }

  selectedYear = endYear;
  print('✅ LULC selectedYear set to:', selectedYear);
};



// exports.getLoadedImage = function() { return loadedImage; };
// ----------------- Updated getLoadedImage -----------------
exports.getLoadedImage = function() {
  if (!roi_boundary || !selectedYear) return null;

  // Load LULC image for the selected year
  var img = ee.Image(
    "projects/corestack-datasets/assets/datasets/LULC_v3_river_basin/pan_india_lulc_v3_" 
    + selectedYear + "_" + (parseInt(selectedYear) + 1)
  ).select('predicted_label');

  img = img.clip(roi_boundary);

  // Collect currently selected checkbox values
  var selectedValues = [];
  checkboxes.forEach(function(cb, index) {
    if (cb.getValue()) selectedValues.push(lulcClasses[index].value);
  });

  if (selectedValues.length === 0) {
    loadedImage = null;  // nothing selected
    return null;
  }

  // Remap selected values to 1, others to 0
  loadedImage = img.remap(
    selectedValues, 
    ee.List.repeat(1, selectedValues.length), 
    0
  ).selfMask();

  return loadedImage;
};


exports.getPanel = function() {
  var panel = ui.Panel();

  panel.add(ui.Label({
    value: 'LULC (IndiaSAT v3): Provide an LULC mask for the current year',
    style: {'fontSize': '16px', 'fontWeight':'bold', 'margin':'15px 0 5px 10px'}
  }));

  panel.add(ui.Label({
    value: 'Select classes where you feel restoration activities might be feasible.',
    style: {'fontSize': '14px'}
  }));

  var checkboxPanel = ui.Panel({style: {margin: '0 10px'}});
  panel.add(checkboxPanel);

  checkboxes = [];
  lulcClasses.forEach(function(cls) {
    var cb = ui.Checkbox(cls.name, false);
    checkboxes.push(cb);
    checkboxPanel.add(cb);
  });
  
  // 🔁 Apply cached JSON values (if any)
  if (pendingLulcValues) {
    print("⏪ Applying cached LULC values:", pendingLulcValues);
    exports.setValues(pendingLulcValues);
    pendingLulcValues = null;
  }

  var buttonPanel = ui.Panel({layout: ui.Panel.Layout.flow('horizontal'), style: {margin: '10px 0', padding: '0 10px'}});
  var loadButton = ui.Button({label: 'Load', style: {margin: '0 5px 0 0', height: '30px'}});
  var clearButton = ui.Button({label: 'Clear Map', style: {margin: '0', height: '30px'}});
  buttonPanel.add(loadButton);
  buttonPanel.add(clearButton);
  panel.add(buttonPanel);

  // var clearMap = function() {
  //   activeMaps.forEach(function(m) {
  //     m.layers().forEach(function(layer) {
  //       if (layer.getName() && layer.getName().indexOf('LULC') === 0) m.remove(layer);
  //     });
  //     lulcUtils.legends.forEach(function(legend) { m.widgets().remove(legend); });
  //   });
  //   lulcUtils.layers = [];
  //   lulcUtils.legends = [];
  //   loadedImage = null;
  // };

  // var loadSelectedLULC = function() {
  //   if (!roi_boundary || !selectedYear) { ui.alert('Error', 'Please set ROI and year first.'); return; }
  //   clearMap();

  //   var img = ee.Image(
  //     "projects/corestack-datasets/assets/datasets/LULC_v3_river_basin/pan_india_lulc_v3_" 
  //     + selectedYear + "_" + (parseInt(selectedYear)+1)
  //   ).select('predicted_label');

  //   img = img.clip(roi_boundary);
    
  //   // loadedImage = img;
    
  //   if (selectedValues.length === 0) {
  //     ui.alert('Please select at least one LULC class.');
  //     loadedImage = null;
  //     return;
  //   }
    
  //   loadedImage = img.remap(
  //     selectedValues,
  //     ee.List.repeat(1, selectedValues.length),
  //     0
  //   ).selfMask();


  //   // collect selected values
  //   var selectedValues = [];
  //   checkboxes.forEach(function(cb, index) {
  //     if (cb.getValue()) selectedValues.push(lulcClasses[index].value);
  //   });

  //   var mask = img.remap(selectedValues, ee.List.repeat(1, selectedValues.length), 0).selfMask();
  //   var vizParams = {palette:['white','green'], min:0, max:1};

  //   activeMaps.forEach(function(m) {
  //     m.addLayer(mask, vizParams, 'LULC');

  //     // ---- LEGEND ----
  //     var legend = ui.Panel({style:{position:'bottom-left', padding:'8px', backgroundColor:'rgba(255,255,255,0.8)'}});
  //     legend.add(ui.Label({value:'LULC', style:{fontWeight:'bold', margin:'0 0 4px 0'}}));

  //     var makeRow = function(color, name) {
  //       var colorBox = ui.Label({style:{backgroundColor: color, padding:'8px', margin:'0 4px 0 0'}});
  //       var description = ui.Label({value: name, style:{margin:'0'}});
  //       return ui.Panel({widgets:[colorBox, description], layout: ui.Panel.Layout.flow('horizontal')});
  //     };

  //     legend.add(makeRow('green','Selected LULC'));
  //     // m.add(legend);
  //     lulcUtils.legends.push(legend);
  //   });
    
  //   if (keepRestorationMarkerOnTopFn) {
  //     ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
  //   }

  // };
  
  var loadSelectedLULC = function() {

    if (!roi_boundary || !selectedYear) {
      ui.alert('Error', 'Please set ROI and year first.');
      return;
    }
  
    clearMap();
  
    var img = ee.Image(
      "projects/corestack-datasets/assets/datasets/LULC_v3_river_basin/pan_india_lulc_v3_" 
      + selectedYear + "_" + (parseInt(selectedYear)+1)
    ).select('predicted_label');
  
    img = img.clip(roi_boundary);
  
    // ✅ FIRST collect selected values
    var selectedValues = [];
    var selectedNames = [];
    checkboxes.forEach(function(cb, index) {
      if (cb.getValue()) {
        selectedValues.push(lulcClasses[index].value);
        selectedNames.push(lulcClasses[index].name);
      }
    });
    
    print("🟢 Selected LULC classes:", selectedNames, selectedValues);

  
    if (selectedValues.length === 0) {
      ui.alert('Please select at least one LULC class.');
      loadedImage = null;
      return;
    }
  
    // ✅ Create mask
    loadedImage = img.remap(
      selectedValues,
      ee.List.repeat(1, selectedValues.length),
      0
    ).selfMask();
  
    var vizParams = {palette:['white','#333333'], min:0, max:1};
  
    activeMaps.forEach(function(m) {
      m.addLayer(loadedImage, vizParams, 'LULC');
    });
  
    if (keepRestorationMarkerOnTopFn) {
      ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
    }
  
  };


  loadButton.onClick(loadSelectedLULC);
  clearButton.onClick(clearMap);

  return panel;
};

// Tick checkbox by name
exports.tickCheckboxByName = function(name) {
  checkboxes.forEach(function(cb) {
    if (cb.getLabel() === name) cb.setValue(true);
  });
};

// Programmatically set multiple LULC classes by values
// exports.setValues = function(values) {
//   checkboxes.forEach(function(cb) { cb.setValue(false); });

//   lulcClasses.forEach(function(cls, index) {
//     // subtract 1 from 1-based input
//     if (values.indexOf(cls.value + 1) !== -1) checkboxes[index].setValue(true);
//   });

//   print("✅ LULC checkboxes updated for 1-based input values:", values);
// };

// exports.setValues = function(values) {

//   if (!Array.isArray(values)) return;

//   if (!checkboxes || checkboxes.length === 0) {
//     print("⚠️ LULC panel not initialized yet");
//     return;
//   }

//   // Clear all first
//   checkboxes.forEach(function(cb) {
//     cb.setValue(false);
//   });

//   // values = array of CLASS NAMES
//   lulcClasses.forEach(function(cls, index) {
//     if (values.indexOf(cls.name) !== -1) {
//       checkboxes[index].setValue(true);
//     }
//   });

//   print("✅ LULC checkboxes set from JSON names:", values);
// };

// exports.setValues = function(values) {

//   if (!Array.isArray(values)) return;

//   if (!checkboxes || checkboxes.length === 0) {
//     print("⚠️ LULC panel not initialized yet");
//     return;
//   }

//   // Clear all first
//   checkboxes.forEach(function(cb) {
//     cb.setValue(false);
//   });

//   // Tick based on class NAMES
//   lulcClasses.forEach(function(cls, index) {
//     if (values.indexOf(cls.name) !== -1) {
//       checkboxes[index].setValue(true);
//     }
//   });

//   print("✅ LULC checkboxes set from JSON names:", values);

//   // 🔥 NEW: Automatically render layer (like Load button)
//   var img = exports.getLoadedImage();

//   if (img) {
//     activeMaps.forEach(function(m) {
//       m.addLayer(img, {palette:['white','green'], min:0, max:1}, 'LULC');
//     });

//     if (keepRestorationMarkerOnTopFn) {
//       ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
//     }
//   }
// };


exports.setValues = function(values) {

  if (!Array.isArray(values)) return;

  // ⏳ UI not ready → cache
  if (checkboxes.length === 0) {
    pendingLulcValues = values;
    return;
  }

  // Clear all
  checkboxes.forEach(function(cb) {
    cb.setValue(false);
  });

  // ✅ SUPPORT BOTH:
  // - numeric values (region presets)
  // - string names (JSON rules)
  lulcClasses.forEach(function(cls, index) {
    if (
      values.indexOf(cls.value) !== -1 ||   // numeric case ✅
      values.indexOf(cls.name) !== -1       // name case ✅
    ) {
      checkboxes[index].setValue(true);
    }
  });

  print('✅ LULC checkboxes set from:', values);
};




// ------------------- Remove legend function -------------------
function removeLegend() {
  lulcUtils.legends.forEach(function(legend) {
    activeMaps.forEach(function(m) {
      if (m && typeof m.widgets === 'function') {
        m.widgets().remove(legend);
      }
    });
  });
  lulcUtils.legends = [];
}

// ------------------- Clear map function (updated) -------------------
function clearMap() {
  // Remove LULC layers
  activeMaps.forEach(function(m) {
    m.layers().forEach(function(layer) {
      if (layer.getName() && layer.getName().indexOf('LULC') === 0) {
        m.remove(layer);
      }
    });
  });

  // Remove legends
  removeLegend();

  lulcUtils.layers = [];
  loadedImage = null;
}

// ------------------- Export functions -------------------
exports.clearMap = clearMap;
exports.removeLegend = removeLegend;


exports.getRule = function() {
  if (!roi_boundary) return null;

  // Collect selected LULC class names
  var selectedNames = [];
  checkboxes.forEach(function(cb, i) {
    if (cb.getValue()) selectedNames.push(lulcClasses[i].name);
  });

  if (selectedNames.length === 0) return null;

  return selectedNames;  // just the selected class labels
};
