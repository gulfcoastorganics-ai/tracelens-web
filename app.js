const camera = document.querySelector("#camera");
const overlay = document.querySelector("#overlay");
const stage = document.querySelector("#stage");
const imageInput = document.querySelector("#imageInput");
const opacityInput = document.querySelector("#opacityInput");
const scaleInput = document.querySelector("#scaleInput");
const rotationInput = document.querySelector("#rotationInput");
const cameraButton = document.querySelector("#cameraButton");
const gridButton = document.querySelector("#gridButton");
const flipButton = document.querySelector("#flipButton");
const resetButton = document.querySelector("#resetButton");
const grid = document.querySelector("#grid");
const emptyState = document.querySelector("#emptyState");
const status = document.querySelector("#status");

let x = 0;
let y = 0;
let scale = 1;
let rotation = 0;
let opacity = 0.55;
let flipped = false;
let dragging = false;
let pointerStartX = 0;
let pointerStartY = 0;
let originX = 0;
let originY = 0;
let stream = null;

function renderOverlay() {
  const flip = flipped ? -1 : 1;
  overlay.style.opacity = opacity;
  overlay.style.transform =
    `translate(${x}px, ${y}px) scale(${scale * flip}, ${scale}) rotate(${rotation}deg)`;
}

async function startCamera() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera access is not supported in this browser.");
    }

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" }
      },
      audio: false
    });

    camera.srcObject = stream;
    status.textContent = "Camera active.";
    cameraButton.textContent = "Restart camera";
  } catch (error) {
    status.textContent =
      "Camera blocked. Open the GitHub Pages HTTPS link and allow camera permission.";
    console.error(error);
  }
}

imageInput.addEventListener("change", event => {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    overlay.src = reader.result;
    overlay.style.display = "block";
    emptyState.style.display = "none";
    status.textContent = "Overlay loaded. Drag it across the preview.";
  };

  reader.onerror = () => {
    status.textContent = "Could not read that image.";
  };

  reader.readAsDataURL(file);
});

opacityInput.addEventListener("input", event => {
  opacity = Number(event.target.value);
  renderOverlay();
});

scaleInput.addEventListener("input", event => {
  scale = Number(event.target.value);
  renderOverlay();
});

rotationInput.addEventListener("input", event => {
  rotation = Number(event.target.value);
  renderOverlay();
});

cameraButton.addEventListener("click", startCamera);

gridButton.addEventListener("click", () => {
  grid.classList.toggle("visible");
});

flipButton.addEventListener("click", () => {
  flipped = !flipped;
  renderOverlay();
});

resetButton.addEventListener("click", () => {
  x = 0;
  y = 0;
  scale = 1;
  rotation = 0;
  opacity = 0.55;
  flipped = false;

  opacityInput.value = opacity;
  scaleInput.value = scale;
  rotationInput.value = rotation;

  renderOverlay();
  status.textContent = "Overlay position reset.";
});

stage.addEventListener("pointerdown", event => {
  if (!overlay.src) return;

  dragging = true;
  pointerStartX = event.clientX;
  pointerStartY = event.clientY;
  originX = x;
  originY = y;
  stage.setPointerCapture(event.pointerId);
});

stage.addEventListener("pointermove", event => {
  if (!dragging) return;

  x = originX + event.clientX - pointerStartX;
  y = originY + event.clientY - pointerStartY;
  renderOverlay();
});

function endDrag(event) {
  dragging = false;

  if (stage.hasPointerCapture(event.pointerId)) {
    stage.releasePointerCapture(event.pointerId);
  }
}

stage.addEventListener("pointerup", endDrag);
stage.addEventListener("pointercancel", endDrag);

renderOverlay();
