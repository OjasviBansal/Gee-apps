
## Workflow

### Step 1 – Select Ecoregion
Dataset:
- RESOLVE/ECOREGIONS/2017
- Clipped to India using FAO/GAUL_SIMPLIFIED_500m

When user clicks on an ecoregion, it is selected and set as the roi boundary. This roi boundary is then passed to all modules.

### Step 2 – Select Restoration Site
User clicks at any point of interest inside the selected ecoregion. The system stores those coordinates and draws a red marker on it. The values for the environment layers (rainfall, elevation, soil, terrain, fire) are auto-initialised for that point. This helps facilitate rule creation.

### Step 3 – Select Environmental Layers
User adjusts the parameters for the environment layers according to their requirements.

### Step 4 – Select Temporal Range
User selects the Restoration start and Base year which are then used by the temporal (changeDetection, fire) layers.

### Step 5 – Validation (Training Map)
This step performs boolean operation on the selected layers to get the validation pixels which are displayed on the training map on the left.
```javascript
var baseLayers = [rainfallImg, tempImg, elevationImg, soilImg, terrainImg, fireImg];

var baseMask = baseLayers
  .map(i => i.gt(0).selfMask())
  .reduce((a,b) => a.and(b));

if (changeDetImg) {
  step5ValidationMask = baseMask.and(changeDetImg.gt(0));
}
```

### Step 6, 7 – Select year and apply masking layers
The current year is selected for applying the masking layers (LULC, ONEs map, Land degradation, Natural forests).

### Step 8 – Final Inference
This is the final rule application stage where the intersection of the validation pixels and the masking layers is taken to get the final inference pixels on the inference map on the right.
```javascript
var andImage = ee.Image(1);

[rainfallImg, tempImg, elevationImg, soilImg,
 terrainImg, fireImg, changeDetImg]
.filter(Boolean)
.forEach(function(img){
  andImage = andImage.and(img.gt(0));
});

[lulcImg, lddImg, nfImg]
.filter(Boolean)
.forEach(function(img){
  andImage = andImage.and(img.gt(0));
});
```

### JSON Rule Export / Import
Users can print as well as reload the rules created. \
Structure:
```json
{
  "rainfall": { "min": 800, "max": 1200 },
  "elevation": { "min": 200, "max": 600 },
  "soil": {...},
  "terrain": {...},
  "years": {
    "train": { "preDeg": 1985, "restoration": 2010 },
    "infer": { "preDeg": 1985, "current": 2024 }
  }
}
```

### Step 9- Post processing
Currently implemented:
- Size-based filtering (removes small pixel clusters from the selected pixels)

Planned:
- SNIC segmentation to grow selected areas to homogenous regions.