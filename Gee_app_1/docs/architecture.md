## Architecture
The application consists of:

- Two synchronized maps
    - trainingMap → Rule construction + validation
    - inferenceMap → Final inference
- Right-side control panel (step-based workflow)
- Layers used for rule creation (each implemented as a separate GEE module)