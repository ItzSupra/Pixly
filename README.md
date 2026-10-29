# Pixly

#### Live Demo: [pixly-cs50.netlify.app](https://pixly-cs50.netlify.app/)  and https://pixly-cs50.vercel.app

#### Description:
**Pixly** is a clean, lightweight, and highly responsive client-side web-based image editor built as my CS50x Final Project. The core design philosophy of Pixly is to deliver a practical, near-instant, and intuitive workspace for everyday image manipulation tasks—such as cropping, rotating, flipping, resizing, and adjusting visual properties (like brightness, contrast, and blur)—without the computational overhead, high learning curve, or bloated interfaces of desktop-class graphics editing software like Adobe Photoshop.

Unlike traditional image editors that rely on server-side processing pipelines (such as Python Flask backend with Pillow or node-canvas instances), Pixly implements a **pure client-side architecture** using the HTML5 Canvas API and JavaScript `FileReader`. This means images are processed entirely within the user's web browser. The primary advantage of this approach is two-fold: it guarantees instant visual feedback at 60 FPS, and it offers complete privacy since the user's files are never transmitted to a remote server. The application is completely self-contained and ready to run anywhere—whether served from a hosting provider like Netlify or opened locally from a disk drive.

---

### Key Features

- **Format Flexibility**: Supports loading and exporting PNG, JPEG, and WebP image formats.
- **Drag & Drop Integration**: Load images by dragging files from your desktop and dropping them directly onto the workspace.
- **Transform Operations**: Free-form cropping with visual coordinate handles, 90-degree rotations, horizontal/vertical flipping, and aspect-ratio locked resizing.
- **Dynamic Adjustments**: Real-time non-destructive slider controls for Blur, Brightness, and Contrast, as well as toggleable filters for Grayscale and Sepia.
- **State History System**: Full Undo, Redo, and Reset capabilities backed by dynamic Blob URL management, featuring a memory-safe history depth cap of 20 states.
- **Keyboard Shortcuts**:
  - `Ctrl + O` / `Cmd + O`: Open Image file picker
  - `Ctrl + S` / `Cmd + S`: Export current Canvas image
  - `Ctrl + Z` / `Cmd + Z`: Undo last action
  - `Ctrl + Y` / `Cmd + Y` / `Ctrl + Shift + Z`: Redo next action
  - `Esc`: Cancel active crop overlay or close resize panel

---

### Canvas Layering Architecture & Rendering Pipeline

A central highlight of Pixly's implementation is its layered canvas system. Rather than using multiple separate DOM canvas overlays which can cause synchronization issues and alignment lag, Pixly utilizes a single HTML5 `<canvas>` element and structures its graphics rendering pipeline into distinct sequential logical layers inside the `requestAnimationFrame` loop:

1. **The Transparent Checkerboard Layer (CSS)**:
   - To represent transparent areas in PNG and WebP images accurately, a custom checkerboard pattern is implemented directly in CSS using repeating linear gradients on the canvas element's background. This ensures that transparent images show a classic checkerboard grid without needing to render pixel grids onto the canvas context.
2. **The Base Image Layer (Canvas Context)**:
   - On every frame redraw, the canvas dimensions are synchronized with the active image state's dimensions. The 2D rendering context (`2d`) is cleared, and the underlying transformed image data is drawn directly onto the coordinate grid.
3. **The Non-Destructive Filter Composition Layer (Canvas Context)**:
   - Visual filters (brightness, contrast, blur, grayscale, sepia) are applied programmatically using the `ctx.filter` API prior to drawing the base image. This allows adjustments to remain fully non-destructive; slider adjustments update the filter string parameters and redraw the base image dynamically.
4. **The Interactive Crop Overlay Layer (Canvas Context UI)**:
   - When the Crop tool is activated, an interactive overlay layer is drawn on top of the filtered image:
     - First, a translucent dark gray rectangle (`rgba(0, 0, 0, 0.5)`) covers the entire canvas.
     - Second, a clipping path is defined for the selected crop rectangle using `ctx.clip()`, and the image is redrawn inside this region with its active filters, creating a bright "windowed" preview of the cropped area.
     - Third, a high-contrast outline border is stroked around the crop bounds.
     - Fourth, interactive corner handle squares are rendered at the boundaries.
     - Fifth, a text dimensions badge displaying the crop region width and height in real-time pixels is rendered above the crop box.

---

### Project File Breakdown

- **`index.html`**: Contains the semantic HTML structure of Pixly. It organizes the interface into a header (with quick file opening and export actions), a left sidebar (toolbar categorized into *Transform*, *Adjustments*, and *History* tools), a central main workspace (housing the canvas element and drag-and-drop overlay zone), and a footer status bar displaying image dimensions and file types.
- **`style.css`**: Defines a clean, neutral utility theme avoiding unnecessary gradients or glassmorphism. It uses CSS custom properties (variables) for theme consistency, Flexbox for layout management, checkerboard background patterns for transparent image rendering, drag-and-drop backdrop indicators, and media queries for responsive mobile adaptivity.
- **`editor.js`**: Contains the core application logic implemented as an OOP `ImageEditor` class. It manages image loading, dynamic canvas scaling, transformation math (rotation, flipping, cropping with visual boundary overlays), filter application (brightness, contrast, blur, grayscale, sepia), real-time rendering throttled by `requestAnimationFrame`, keyboard navigation, drag-and-drop dropzones, an undo/redo state history stack capped at 20 states with Blob URL memory safety, and JPEG export white-background canvas drawing to prevent black background artifacts.

---

### Key Design Decisions & CS50 Concepts

1. **Pure Client-Side Architecture (HTML5 Canvas API)**:
   - *Decision:* Rather than sending image files to a Python/Flask server to process with libraries like Pillow, I opted to execute all pixel manipulations client-side in JavaScript.
   - *Rationale:* This provides zero-latency editing, eliminates server costs and security risks, and makes the project entirely self-contained.

2. **State-Based History System (Undo / Redo / Reset)**:
   - *Decision:* Instead of tracking continuous mathematical transformation vectors, each confirmed operation (such as a crop or rotation) serializes the canvas state as a binary Blob URL and pushes it into a linear history array.
   - *Rationale:* This guarantees 100% accurate visual restoration during Undo/Redo actions regardless of how many different operations were performed. Memory bloat is prevented by enforcing a `MAX_HISTORY` limit of 20 states and calling `URL.revokeObjectURL()`.

3. **Performance Optimization (`requestAnimationFrame` & PointerEvents)**:
   - *Decision:* Real-time slider events (`input`) and interactive canvas cropping schedule canvas redraws using `requestAnimationFrame` and W3C `PointerEvents`.
   - *Rationale:* This prevents layout thrashing and unnecessary repaints, ensuring a smooth 60 FPS user experience even when manipulating large images across touch and mouse devices.

---

### Key Learnings & HTML5 Canvas Technical Insights

Building Pixly provided deep hands-on technical insights into web APIs and graphics programming:
- **Canvas Coordinate Transformations**: Mastered 2D canvas context manipulation (`translate`, `rotate`, `scale`, `drawImage`), including calculating center-origin offset pivots when rotating images 90° or flipping horizontally/vertically.
- **Filter Composition & Export Baking**: Discovered the distinction between real-time CSS/Canvas `filter` string rendering vs baking composite filters onto offscreen export canvases.
- **Alpha Channel & JPEG Transparency**: Learned how transparent PNG/WebP images default to pitch black when converted to JPEG (due to JPEG's lack of an alpha channel), leading to the implementation of automatic white background pre-filling before JPEG rasterization.
- **Memory Safety with Object URLs**: Mastered browser memory lifecycle management using `URL.createObjectURL()` and `URL.revokeObjectURL()` to build a light, responsive undo/redo stack without leaking browser RAM.

---

### AI Collaboration & Academic Honesty Disclosure

In accordance with CS50x Academic Honesty guidelines, AI tools (specifically Google DeepMind's Antigravity AI pair programming assistant) were utilized during the development of this project:
- **Brainstorming & Architecture**: Brainstorming optimal client-side architecture options (HTML5 Canvas vs backend Python Flask/Pillow processing) and UI layout structure.
- **Code Audit & Edge-Case Debugging**: Auditing JavaScript OOP private class field interactions, fixing event handler scopes, and refining PointerEvents crop box selection bounds.
- **Finishing Touches**: Adding quality-of-life enhancements such as drag-and-drop workspace dropzones, keyboard shortcuts (`Ctrl+O`, `Ctrl+S`, `Ctrl+Z`, `Ctrl+Y`, `Esc`), and polishing project documentation.

---

### How to Run & Test
1. Clone or download the repository files into a directory.
2. Double-click `index.html` to open Pixly in any modern browser (Chrome, Edge, Firefox, Safari).
3. Click **Open Image** or drag and drop a PNG, JPEG, or WebP file onto the workspace.
4. Experiment with cropping, rotating, flipping, resizing, and adjusting brightness, contrast, blur, grayscale, or sepia.
5. Click **Export** or press `Ctrl+S` to save your final edited image locally!

