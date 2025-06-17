(function () {
  function initCanvas() {
    const canvas = document.getElementById('drawingCanvas');
    if (!canvas) {
      console.error("Canvas element not found!");
      return;
    }

    let masterid = null;

    // 1️⃣ Message listener for parent iframe communication
    window.addEventListener('message', function (event) {
      if (event.data && event.data.type === 'setmasterid') {
        console.log("✅ Received masterid from parent:", event.data.masterid);
        masterid = event.data.masterid;
        localStorage.setItem('cachedmasterid', masterid);
      }
    }, false);

    // 2️⃣ Robust fallback to retrieve masterid
    function tryToGetmasterid() {
      let attempts = 0;
      const maxAttempts = 10;
      const intervalMs = 500;

      function check() {
        attempts++;

        if (!masterid && typeof Qualtrics !== 'undefined' && Qualtrics.SurveyEngine) {
          const qid = Qualtrics.SurveyEngine.getEmbeddedData('masterid');
          if (qid) {
            console.log(`[✔] Found masterid from Qualtrics: ${qid}`);
            masterid = qid;
            localStorage.setItem('cachedmasterid', masterid);
            return;
          }
        }

        if (!masterid) {
          const urlParams = new URLSearchParams(window.location.search);
          const urlId = urlParams.get('masterid');
          if (urlId) {
            console.log(`[✔] Found masterid from URL: ${urlId}`);
            masterid = urlId;
            localStorage.setItem('cachedmasterid', masterid);
            return;
          }
        }

        if (!masterid) {
          const stored = localStorage.getItem('cachedmasterid');
          if (stored) {
            console.log(`[✔] Found masterid from localStorage: ${stored}`);
            masterid = stored;
            return;
          }
        }

        if (masterid) return;

        if (attempts < maxAttempts) {
          console.warn(`[!] masterid not yet found, retrying... (${attempts}/${maxAttempts})`);
          setTimeout(check, intervalMs);
        } else {
          console.error(`[✖] Failed to retrieve masterid. Using "missing-id".`);
        }
      }

      check();
    }

    tryToGetmasterid();

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error("Canvas context not available!");
      return;
    }

    let isDrawing = false;
    let brushColor = '#000000';
    let brushSize = 5;

    function setCanvasSize() {
      canvas.width = document.getElementById('canvasContainer').offsetWidth * 2; // High-res
      canvas.height = canvas.width * 3 / 5;
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
    }

    function preserveDrawingOnResize() {
      const savedData = canvas.toDataURL();
      setCanvasSize();

      const img = new Image();
      img.onload = function () {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = savedData;
    }

    // Initial canvas setup
    setCanvasSize();

    // Redraw drawing on resize or orientation change
    window.addEventListener('resize', preserveDrawingOnResize);
    window.addEventListener('orientationchange', preserveDrawingOnResize);

    function clearCanvas() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function setBrushColor(color) {
      brushColor = color;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
    }

    function setBrushSize(size) {
      brushSize = size;
      ctx.lineWidth = size;
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.imageSmoothingEnabled = true;

    setBrushColor(brushColor);
    setBrushSize(brushSize);

    function getMousePos(canvas, e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }

    canvas.addEventListener('mousedown', function (e) {
      isDrawing = true;
      ctx.beginPath();
      const pos = getMousePos(canvas, e);
      ctx.moveTo(pos.x, pos.y);
    });

    canvas.addEventListener('mousemove', function (e) {
      if (isDrawing) {
        const pos = getMousePos(canvas, e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      }
    });

    canvas.addEventListener('mouseup', () => isDrawing = false);
    canvas.addEventListener('mouseout', () => isDrawing = false);

    function handleTouchStart(e) {
      e.preventDefault();
      isDrawing = true;
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      ctx.beginPath();
      ctx.moveTo((touch.clientX - rect.left) * scaleX, (touch.clientY - rect.top) * scaleY);
    }

    function handleTouchMove(e) {
      e.preventDefault();
      if (isDrawing) {
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        ctx.lineTo((touch.clientX - rect.left) * scaleX, (touch.clientY - rect.top) * scaleY);
        ctx.stroke();
      }
    }

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', () => isDrawing = false, { passive: false });
    canvas.addEventListener('touchcancel', () => isDrawing = false, { passive: false });

    document.getElementById('colorPicker').addEventListener('input', function () {
      setBrushColor(this.value);
    });

    document.getElementById('colorButtons').addEventListener('click', function (e) {
      if (e.target.tagName === 'BUTTON') {
        setBrushColor(e.target.dataset.color);
      }
    });

    document.getElementById('brushSizeSlider').addEventListener('input', function () {
      setBrushSize(this.value);
    });

    document.getElementById('clearButton').addEventListener('click', function (e) {
      e.preventDefault();
      clearCanvas();
    });

    document.getElementById('saveButton').addEventListener('click', function () {
      const dataURL = canvas.toDataURL('image/png');
      const base64Data = dataURL.replace(/^data:image\/(png|jpeg);base64,/, '');
      const pipedreamEndpoint = 'https://eokgo6mythi361d.m.pipedream.net';

      console.log("📤 Sending drawing to Pipedream...");
      console.log("📎 masterid:", masterid || "missing-id");

      fetch(pipedreamEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData: base64Data,
          masterid: masterid || "missing-id"
        })
      })
        .then(response => {
          if (response.ok) {
            console.log("✅ Successfully sent to Pipedream.");
            const msg = document.getElementById('saveMessage');
            if (msg) {
              msg.style.display = 'block';
              msg.style.opacity = '1';
              setTimeout(() => {
                msg.style.opacity = '0';
                setTimeout(() => msg.style.display = 'none', 500);
              }, 2000);
            }
          } else {
            console.error("❌ Failed to send to Pipedream.");
          }
        })
        .catch(error => console.error("🚫 Error sending to Pipedream:", error));
    });
  }

  initCanvas();
})();
