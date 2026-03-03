# Ecotype Identification- App 2

It is interactive Google Earth Engine (GEE) application built for identifying ecological restoration sites based on rule-based spatial and temporal similarity.

App link: https://ee-apoorvadewan13.projects.earthengine.app/view/ecotype-identification-sites--app2

## Overview
It enables users to:
- Select a restoration site in India
- Get spatial + temporal rules
- Can also validate those rules locally
- Export and re-load rule configurations via JSON

The system is entirely server-side computed in Earth Engine, using boolean mask intersections across multiple environmental datasets.

## Documentation

Detailed technical documentation is available in:

- [Architecture](docs/architecture.md)
- [Workflow](docs/workflow.md)
- [Modules Guide](docs/modules.md)
- [Data Sources](docs/data-sources.md)
