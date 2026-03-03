# Ecotype Identification- App 1

It is interactive Google Earth Engine (GEE) application built for identifying ecological restoration sites based on rule-based spatial and temporal similarity.

App link: https://ee-apoorvadewan13.projects.earthengine.app/view/ecotype-identification-app1

## Overview
It enables users to:
- Select an ecoregion (India)
- Mark a reference restoration site
- Extract environmental characteristics
- Construct spatial + temporal rules
- Validate those rules locally
- Apply them across the ecoregion to detect similar candidate restoration sites
- Export and re-load rule configurations via JSON

The system is entirely server-side computed in Earth Engine, using boolean mask intersections across multiple environmental datasets.

## Documentation

Detailed technical documentation is available in:

- [Architecture](docs/architecture.md)
- [Workflow](docs/workflow.md)
- [Modules Guide](docs/modules.md)
- [Data Sources](docs/data-sources.md)
