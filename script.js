const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");
const input = document.getElementById("items");
const button = document.getElementById("spin");
const result = document.getElementById("result");
const error = document.getElementById("error");

const TAU = Math.PI * 2;

const colors = [
  "#dce9ac", "#8daf99", "#f0d996", "#baca83",
  "#eee8d6", "#a6c5bd", "#efc5a0", "#cbdcc7",
  "#d6ce9b", "#b3d4e0", "#ddc3df", "#e6dfa8"
];

let items = [];
let rotation = 0;
let spinning = false;
let valid = false;

// 현재 누르기 동작: { source, id, startedAt }
let press = null;

function draw() {
  ctx.clearRect(0, 0, 800, 800);
  if (!items.length) return;

  const arc = TAU / items.length;

  items.forEach((text, i) => {
    const start = rotation - Math.PI / 2 + i * arc;

    ctx.beginPath();
    ctx.moveTo(400, 400);
    ctx.arc(400, 400, 400, start, start + arc);
    ctx.closePath();

    ctx.fillStyle = colors[i];
    ctx.fill();

    ctx.strokeStyle = "#ffffff80";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.translate(400, 400);
    ctx.rotate(start + arc / 2);

    ctx.fillStyle = "#23473b";
    ctx.font = "bold 27px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const chars = Array.from(text);
    const label = chars.length > 8
      ? chars.slice(0, 7).join("") + "…"
      : text;

    ctx.fillText(label, 245, 0, 245);
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(400, 400, 44, 0, TAU);
  ctx.fillStyle = "#fffefa";
  ctx.fill();
}

function updateItems() {
  const lines = input.value
    .split("\n")
    .map(text => text.trim())
    .filter(Boolean);

  valid = lines.length >= 2 && lines.length <= 12;
  items = lines.slice(0, 12);

  error.textContent = valid
    ? ""
    : "항목을 2~12개 입력해주세요.";

  button.disabled = !valid;
  rotation = 0;
  result.textContent = "준비되면 돌려보세요.";

  draw();
}

// 나머지 연산 편향을 없앤 랜덤 정수
function randomIndex(count) {
  const buffer = new Uint32Array(1);
  const limit = Math.floor(4294967296 / count) * count;

  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);

  return buffer[0] % count;
}

function chooseWinner(seconds) {
  const n = Math.floor(seconds);

  // [1, 2)초 → 첫 번째, [2, 3)초 → 두 번째 …
  if (n >= 1 && n <= items.length) {
    return n - 1;
  }

  // 1초 미만 또는 대응하는 항목이 없으면 랜덤
  return randomIndex(items.length);
}

function spin(seconds) {
  if (spinning || !valid) return;

  spinning = true;
  input.disabled = true;
  button.disabled = true;
  button.textContent = "돌아가는 중…";
  result.textContent = "이번에는 무엇이 나올까요?";

  const selected = chooseWinner(seconds);
  const arc = TAU / items.length;

  // 선택한 조각의 중앙을 위쪽 화살표에 맞춥니다.
  const target = (TAU - (selected + 0.5) * arc) % TAU;
  const from = rotation;
  const distance =
    TAU * 6 + ((target - from % TAU + TAU) % TAU);

  const reducedMotion = matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const duration = reducedMotion ? 50 : 4500;
  const startedAt = performance.now();

  function animate(now) {
    const progress = Math.min((now - startedAt) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 5);

    rotation = from + distance * eased;
    draw();

    if (progress < 1) {
      requestAnimationFrame(animate);
      return;
    }

    rotation = target;
    draw();

    result.textContent = `🎉 ${items[selected]} 당첨!`;
    spinning = false;
    input.disabled = false;
    button.disabled = false;
    button.textContent = "한 번 더 돌리기";
  }

  requestAnimationFrame(animate);
}

function beginPress(source, id) {
  if (press || spinning || !valid) return false;

  press = {
    source,
    id,
    startedAt: performance.now()
  };

  input.disabled = true;
  button.classList.add("holding");

  return true;
}

function clearPress() {
  press = null;
  button.classList.remove("holding");

  if (!spinning) {
    input.disabled = false;
  }
}

function finishPress(source, id) {
  if (!press || press.source !== source || press.id !== id) {
    return;
  }

  const seconds = (performance.now() - press.startedAt) / 1000;

  clearPress();
  spin(seconds);
}

// 마우스 및 터치
button.addEventListener("pointerdown", event => {
  if (!event.isPrimary || event.button !== 0) return;

  if (beginPress("pointer", event.pointerId)) {
    button.setPointerCapture(event.pointerId);
  }
});

button.addEventListener("pointerup", event => {
  finishPress("pointer", event.pointerId);
});

button.addEventListener("pointercancel", clearPress);

button.addEventListener("lostpointercapture", () => {
  if (press?.source === "pointer") {
    clearPress();
  }
});

// 길게 터치했을 때 메뉴가 열리는 것을 방지
button.addEventListener("contextmenu", event => {
  event.preventDefault();
});

// 키보드: Space 또는 Enter를 누른 시간 측정
button.addEventListener("keydown", event => {
  if (event.code !== "Space" && event.code !== "Enter") return;

  event.preventDefault();

  if (!event.repeat) {
    beginPress("keyboard", event.code);
  }
});

button.addEventListener("keyup", event => {
  if (event.code !== "Space" && event.code !== "Enter") return;

  event.preventDefault();
  finishPress("keyboard", event.code);
});

// 보조 기술의 직접 클릭은 짧게 누른 것으로 처리
button.addEventListener("click", event => {
  if (event.detail === 0 && !press && !spinning) {
    spin(0);
  }
});

// 창 전환 등으로 누르기가 중단되면 취소
button.addEventListener("blur", clearPress);
window.addEventListener("blur", clearPress);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clearPress();
  }
});

input.addEventListener("input", updateItems);

updateItems();