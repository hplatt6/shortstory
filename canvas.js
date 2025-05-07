(function () {
  function initCanvas() {
    const canvas = document.getElementById('drawingCanvas');
    if (!canvas) {
      console.error("Canvas element not found!");
      return;
    }

    let uniqueId = null;
    let retryCount = 0;
    const maxRetries = 10;
    const retryDelay = 500;

    // Receive uniqueId from parent
    window.addEventListener('message', function (event) {
      if (event.data && event.data.type === 'setUniqueId') {
        console.log("✅ Received uniqueId from parent:", event.data.uniqueId);
        uniqueId = event.data.uniqueId;
      }
    }, false);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error("Canvas context not available!");
      return;
    }

    let isDrawing = false;
    let brushColor = '#000000';
    let brushSize = 5;
    let lastPos = null;

    // Set line style for smoother appearance
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    function setCanvasSize() {
      const container = document.getElementById('canvasContainer');
      const width = container.offsetWidth;
      const height = width * 3 / 5;

      const scale = window.devicePixelRatio || 1;

      canvas.width = width * scale;
      canvas.height = height * scale;

      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(scale, scale);
    }

    function preserveDrawingOnResize() {
      const savedData = canvas.toDataURL();
      setCanvasSize();

      const img = new Image();
      img.onload = function () {
        ctx.drawImage(
          img,
          0,
          0,
          canvas.width / (window.devicePixelRatio || 1),
          canvas.height / (window.devicePixelRatio || 1)
        );
      };
      img.src = savedData;
    }

    // Initial canvas setup
    setCanvasSize();

    // Handle resizing and orientation changes
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

    setBrushColor(brushColor);
    setBrushSize(brushSize);

    function getMousePos(canvas, e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX / (window.devicePixelRatio || 1),
        y: (e.clientY - rect.top) * scaleY / (window.devicePixelRatio || 1)
      };
    }

    canvas.addEventListener('mousedown', function (e) {
      isDrawing = true;
      lastPos = getMousePos(canvas, e);
      ctx.beginPath();
      ctx.moveTo(lastPos.x, lastPos.y);
      e.preventDefault();
    });

    canvas.addEventListener('mousemove', function (e) {
      if (!isDrawing) return;
      const pos = getMousePos(canvas, e);
      const midPoint = {
        x: (lastPos.x + pos.x) / 2,
        y: (lastPos.y + pos.y) / 2
      };
      ctx.quadraticCurveTo(lastPos.x, lastPos.y, midPoint.x, midPoint.y);
      ctx.stroke();
      lastPos = pos;
    });

    canvas.addEventListener('mouseup', () => isDrawing = false);
    canvas.addEventListener('mouseout', () => isDrawing = false);

    function getTouchPos(e) {
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (touch.clientX - rect.left) * scaleX / (window.devicePixelRatio || 1),
        y: (touch.clientY - rect.top) * scaleY / (window.devicePixelRatio || 1)
      };
    }

    function handleTouchStart(e) {
      e.preventDefault();
      isDrawing = true;
      lastPos = getTouchPos(e);
      ctx.beginPath();
      ctx.moveTo(lastPos.x, lastPos.y);
    }

    function handleTouchMove(e) {
      e.preventDefault();
      if (!isDrawing) return;
      const pos = getTouchPos(e);
      const midPoint = {
        x: (lastPos.x + pos.x) / 2,
        y: (lastPos.y + pos.y) / 2
      };
      ctx.quadraticCurveTo(lastPos.x, lastPos.y, midPoint.x, midPoint.y);
      ctx.stroke();
      lastPos = pos;
    }

    function handleTouchEnd() {
      isDrawing = false;
    }

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

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

    function sendBase64ToPipedream() {
      if (!uniqueId) {
        if (retryCount < maxRetries) {
          retryCount++;
          console.warn(`[!] uniqueId not yet found, retrying... (${retryCount}/${maxRetries})`);
          setTimeout(sendBase64ToPipedream, retryDelay);
        } else {
          console.error("❌ uniqueId still missing after retries. Sending with 'missing-id'.");
          doSend("missing-id");
        }
        return;
      }
      doSend(uniqueId);
    }

    function doSend(idToUse) {
      const dataURL = canvas.toDataURL('image/png');
      const base64Data = dataURL.replace(/^data:image\/(png|jpeg);base64,/, '');

      const pipedreamEndpoint = 'https://eohcxmdz17lowq5.m.pipedream.net';
      console.log("📤 Sending drawing to Pipedream...");
      console.log("📎 uniqueId:", idToUse);

      fetch(pipedreamEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData: base64Data,
          uniqueId: idToUse
        })
      })
        .then(response => {
          if (response.ok) {
            console.log('✅ Successfully sent to Pipedream.');
            const msg = document.getElementById('saveMessage');
            if (msg) {
              msg.style.display = 'block';
              msg.style.opacity = '1';
              setTimeout(() => {
                msg.style.opacity = '0';
                setTimeout(() => {
                  msg.style.display = 'none';
                }, 500);
              }, 2000);
            }
          } else {
            console.error('❌ Failed to send to Pipedream.');
          }
        })
        .catch(error => {
          console.error('❌ Error sending to Pipedream:', error);
        });
    }

    const saveButton = document.getElementById("saveButton");
    if (saveButton) {
      saveButton.addEventListener("click", sendBase64ToPipedream);
    }
  }

  initCanvas();
})();
