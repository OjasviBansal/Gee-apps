
## Workflow

### Step 1 – Select Restoration site
When user selects a restoration site from drop-down menu, it is selected and set as the roi boundary. This roi boundary is then passed to all modules.
When user clicks on set location button, the values for the environment layers (rainfall, elevation, soil, terrain, fire) are auto-initialised for that site. This helps facilitate rule creation.

### Step 2 – Select Environmental Layers
User adjusts the parameters for the environment layers according to their requirements.

### Step 3, 4 – Apply tie-based layers
The restoration start and base year is selected and  used for applying the time-based layers layers (change-detection, fire).

### Step 5, 6 – Select year and apply masking layers
The current year is selected for applying the masking layers (LULC, ONEs map, Land degradation, Natural forests).

### Step 7 – Compute AND
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

### Step 8 - Post processing
Currently implemented:
- Size-based filtering (removes small pixel clusters from the selected pixels)

Planned:
- SNIC segmentation to grow selected areas to homogenous regions.