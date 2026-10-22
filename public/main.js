(() => {
  // ---------------------------------------------------------------- theme
  // Same three choices as Settings > Appearance in the app.
  const THEME_KEY = "powerhouse-theme";
  const darkQuery = matchMedia("(prefers-color-scheme: dark)");
  const readTheme = () => { try { const t = localStorage.getItem(THEME_KEY); return t === "light" || t === "dark" ? t : "system"; } catch { return "system"; } };
  let themeChoice = readTheme();
  const isDark = () => themeChoice === "dark" || (themeChoice === "system" && darkQuery.matches);
  function applyTheme() {
    if (themeChoice === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", themeChoice);
    for (const b of document.querySelectorAll("[data-theme-choice]")) b.setAttribute("aria-checked", String(b.dataset.themeChoice === themeChoice));
    orb && orb.setCore(isDark() ? CORE_DARK : CORE_LIGHT);
  }
  for (const b of document.querySelectorAll("[data-theme-choice]")) {
    b.addEventListener("click", () => {
      themeChoice = b.dataset.themeChoice;
      try { themeChoice === "system" ? localStorage.removeItem(THEME_KEY) : localStorage.setItem(THEME_KEY, themeChoice); } catch {}
      applyTheme();
    });
  }
  darkQuery.addEventListener("change", applyTheme);

  // ------------------------------------------------------------------ orb
  // The app's orb (src/client/pulse/blob.ts): ray-marched metaballs, one per
  // running job in its role's color, pulsing amber while a job needs you.
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const CORE_LIGHT = [0.93, 0.91, 0.88];
  const CORE_DARK = [0.42, 0.39, 0.36];
  const MAX = 10;

  function oklchToRgb(l, c, h) {
    const hr = (h * Math.PI) / 180, a = c * Math.cos(hr), b = c * Math.sin(hr);
    const L = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const M = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const S = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const enc = (x) => { const v = Math.min(1, Math.max(0, x)); return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055; };
    return [enc(4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S), enc(-1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S), enc(-0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S)];
  }

  const FRAG = `#version 300 es
  precision highp float;
  uniform float uTime; uniform vec2 uResolution; uniform int uCount;
  uniform vec4 uBalls[${MAX}]; uniform vec4 uColors[${MAX}]; uniform float uEnergy;
  out vec4 fragColor;
  float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
  float sdf(vec3 p) {
    float d = 1e5;
    for (int i = 0; i < ${MAX}; i++) {
      if (i >= uCount) break;
      vec4 b = uBalls[i];
      if (b.w < 0.001) continue;
      float wob = sin(p.y * 6.0 + uTime * 1.6 + float(i)) * 0.012 * (1.0 + uEnergy * 3.0);
      d = smin(d, length(p - b.xyz) - b.w + wob, 0.32);
    }
    return d;
  }
  vec3 normalAt(vec3 p) { vec2 e = vec2(0.002, 0.0); return normalize(vec3(sdf(p + e.xyy) - sdf(p - e.xyy), sdf(p + e.yxy) - sdf(p - e.yxy), sdf(p + e.yyx) - sdf(p - e.yyx))); }
  vec4 colorAt(vec3 p) {
    vec3 acc = vec3(0.0); float wsum = 0.0; float alert = 0.0;
    for (int i = 0; i < ${MAX}; i++) {
      if (i >= uCount) break;
      vec4 b = uBalls[i];
      if (b.w < 0.001) continue;
      float w = 1.0 / pow(max(length(p - b.xyz) - b.w * 0.5, 0.02), 3.0);
      acc += uColors[i].rgb * w; alert = max(alert, uColors[i].a * w); wsum += w;
    }
    return vec4(acc / max(wsum, 1e-4), clamp(alert / max(wsum, 1e-4), 0.0, 1.0));
  }
  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
    vec3 ro = vec3(0.0, 0.0, 3.2); vec3 rd = normalize(vec3(uv, -1.6));
    float t = 0.0; float hit = 0.0;
    for (int i = 0; i < 72; i++) { vec3 p = ro + rd * t; float d = sdf(p); if (d < 0.001) { hit = 1.0; break; } t += d; if (t > 6.0) break; }
    if (hit < 0.5) { fragColor = vec4(0.0); return; }
    vec3 p = ro + rd * t; vec3 n = normalAt(p); vec4 c = colorAt(p);
    vec3 base = c.rgb; float pulse = 0.5 + 0.5 * sin(uTime * 6.0);
    base = mix(base, vec3(1.0, 0.68, 0.25), c.a * (0.5 + 0.5 * pulse));
    vec3 l = normalize(vec3(-0.5, 0.8, 0.7));
    float diff = clamp(dot(n, l), 0.0, 1.0);
    float fres = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 2.5);
    vec3 h = normalize(l - rd); float spec = pow(clamp(dot(n, h), 0.0, 1.0), 60.0);
    vec3 film = 0.5 + 0.5 * cos(6.2831 * (fres * 1.3 + vec3(0.0, 0.33, 0.67)) + uTime * 0.3);
    vec3 col = base * (0.55 + 0.6 * diff); col = mix(col, film, fres * 0.55); col += spec * 0.7;
    fragColor = vec4(col * 1.0, 1.0);
  }`;
  const VERT = `#version 300 es
  in vec2 position; void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

  function createOrb(host, speed) {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: false, alpha: true });
    if (!gl) { const f = document.createElement("div"); f.className = "fallback"; host.appendChild(f); return null; }
    host.appendChild(canvas);
    const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); const f = document.createElement("div"); f.className = "fallback"; host.appendChild(f); return null; }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "position");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    const u = (n) => gl.getUniformLocation(prog, n);
    const U = { time: u("uTime"), res: u("uResolution"), count: u("uCount"), balls: u("uBalls"), colors: u("uColors"), energy: u("uEnergy") };

    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(host.clientWidth * dpr);
      canvas.height = Math.round(host.clientHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    new ResizeObserver(resize).observe(host);
    resize();

    // Balls ease toward their targets; leaving ones shrink, then go.
    let balls = [{ id: "core", r: 0, tr: 0.5, grow: 0, color: CORE_LIGHT.slice(), tcolor: CORE_LIGHT.slice(), alert: 0, talert: 0, orbit: 0, speed: 0, phase: 0, tilt: 0 }];
    let spawned = 0, energy = 0, tenergy = 0;
    const start = performance.now();
    let last = start;

    function setJobs(jobs) {
      const ids = new Set(jobs.map((j) => j.id));
      for (const b of balls) if (b.id !== "core" && !ids.has(b.id) && !b.leaving) { b.leaving = 0; b.r0 = b.r; b.orbit0 = b.orbit; }
      for (const j of jobs) {
        let b = balls.find((x) => x.id === j.id && x.leaving === undefined);
        if (!b) {
          if (balls.length >= MAX) continue;
          const i = ++spawned;
          b = { id: j.id, r: 0, grow: 0, color: j.color.slice(), alert: 0, orbit: 0.8 + (i % 3) * 0.11, phase: i * 2.399, speed: 0.35 + (i % 4) * 0.08, tilt: (i % 2 ? 1 : -1) * (0.4 + (i % 3) * 0.25) };
          balls.push(b);
        }
        b.tr = 0.2; b.tcolor = j.color.slice(); b.talert = j.alert ? 1 : 0;
      }
      const core = balls[0];
      core.tr = 0.5 + Math.min(jobs.length, 6) * 0.02;
      tenergy = Math.min(1, jobs.length / 6);
    }
    function setCore(color) { balls[0].tcolor = color.slice(); }

    // gsap's elastic.out(1, 0.5), which the app uses when a job's ball appears.
    const elastic = (p) => (p >= 1 ? 1 : 1 + 2 ** (-10 * p) * Math.sin((p - 0.125) * 4 * Math.PI));
    const GROW = 1.4, LEAVE = 1.2;
    const B = new Float32Array(MAX * 4), C = new Float32Array(MAX * 4);
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const t = ((now - start) / 1000) * speed;
      const k = 1 - Math.exp(-dt * 5);
      energy += (tenergy - energy) * k;
      balls = balls.filter((b) => !(b.leaving !== undefined && b.leaving >= LEAVE));
      B.fill(0); C.fill(0);
      balls.slice(0, MAX).forEach((b, i) => {
        if (b.leaving !== undefined) {
          // power2.in: shrink while flying outward, as in the app.
          b.leaving += dt;
          const e = Math.min(1, b.leaving / LEAVE) ** 2;
          b.r = b.r0 * (1 - e);
          b.orbit = b.orbit0 * (1 + 0.8 * e);
        } else if (b.grow < GROW) {
          b.grow += dt;
          b.r = b.tr * elastic(b.grow / GROW);
        } else {
          b.r += (b.tr - b.r) * k;
        }
        b.alert += ((b.talert || 0) - b.alert) * k;
        for (let c = 0; c < 3; c++) b.color[c] += (b.tcolor[c] - b.color[c]) * k;
        const a = b.phase + t * b.speed;
        const x = Math.cos(a) * b.orbit, y = Math.sin(a) * b.orbit * Math.sin(b.tilt) * 0.8, z = Math.sin(a) * b.orbit * Math.cos(b.tilt) * 0.6;
        const breathe = b.id === "core" ? 1 + Math.sin(t * 1.2) * 0.04 : 1;
        B.set([x, y, z, b.r * breathe], i * 4);
        C.set([b.color[0], b.color[1], b.color[2], b.alert], i * 4);
      });
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(U.time, t);
      gl.uniform2f(U.res, canvas.width, canvas.height);
      gl.uniform1i(U.count, Math.min(balls.length, MAX));
      gl.uniform4fv(U.balls, B);
      gl.uniform4fv(U.colors, C);
      gl.uniform1f(U.energy, energy);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return { setJobs, setCore };
  }

  const orb = createOrb(document.getElementById("orb"), reduced ? 0.15 : 1);

  // ----------------------------------------------------------------- demo
  // A scripted run through what powerhouse does. Everything here is an
  // example: the roles, jobs and people are made up.
  const ROLES = {
    routing: { name: "Routing", hue: 0, chroma: 0 },
    researcher: { name: "Researcher", hue: 30 },
    comms: { name: "Communications", hue: 160 },
    digest: { name: "Changelog digest", hue: 60 },
    triage: { name: "Support triage", hue: 220 },
    marketer: { name: "Product marketer", hue: 300 },
    generalist: { name: "Generalist", hue: 245 },
    ops: { name: "Ops", hue: 130 },
  };
  const hueCss = (r) => (r.chroma === 0 ? "#b5aea4" : `oklch(0.72 0.15 ${r.hue})`);

  const state = { prompt: "", typing: false, jobs: [], toast: null };
  let approveNow = null;

  const $ = (id) => document.getElementById(id);
  function el(tag, attrs = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "style") n.setAttribute("style", v);
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids) if (kid != null) n.append(kid);
    return n;
  }

  function renderPrompt() {
    const p = $("prompt");
    p.replaceChildren();
    if (state.prompt) { p.removeAttribute("data-empty"); p.append(state.prompt); }
    else { p.setAttribute("data-empty", ""); p.append(state.placeholder || "What needs doing?"); }
    if (state.typing) p.append(el("span", { class: "caret" }));
  }

  // Cards are keyed by job: an existing card is updated in place, so only
  // new cards play their entrance (rebuilding them all made them flicker).
  function pillContent(j) {
    const r = ROLES[j.role];
    const kids = [
      el("span", { class: "d" }),
      el("b", {}, r.name),
      el("span", { class: "act" + (j.busy ? " shimmer" : "") }, j.text),
    ];
    if (j.meta) kids.push(el("span", { class: "meta" }, j.meta));
    if (j.ask) {
      kids.push(el("div", { class: "actions" },
        el("button", { type: "button", class: "approve", onclick: () => approveNow && approveNow("you") }, j.ask),
        j.ask === "Approve" ? el("button", { type: "button", class: "decline", onclick: () => approveNow && approveNow("declined") }, "Decline") : null,
      ));
    }
    return kids;
  }

  function render() {
    renderPrompt();

    const list = $("pills");
    const existing = new Map([...list.children].map((li) => [li.dataset.key, li]));
    const items = state.jobs.map((j) => {
      const r = ROLES[j.role];
      const li = existing.get(j.id) || el("li", { class: "pill", "data-key": j.id });
      const sig = JSON.stringify([j.role, j.text, j.busy, j.meta, j.ask]);
      if (li.dataset.sig !== sig) {
        li.dataset.sig = sig;
        li.style.setProperty("--hue", hueCss(r));
        li.toggleAttribute("data-alert", !!j.ask);
        li.replaceChildren(...pillContent(j));
      }
      return li;
    });
    items.forEach((li, i) => { if (list.children[i] !== li) list.insertBefore(li, list.children[i] || null); });
    while (list.children.length > items.length) list.lastChild.remove();

    const live = state.jobs.filter((j) => !j.done);
    const needs = live.filter((j) => j.ask).length;
    const status = live.length === 0
      ? "Everything is quiet."
      : `${live.length} ${live.length === 1 ? "job is" : "jobs are"} running.` + (needs ? ` ${needs} ${needs === 1 ? "needs" : "need"} you.` : "");
    if ($("status").textContent !== status) $("status").textContent = status;

    const slot = $("toast-slot");
    const toastKey = state.toast ? state.toast.title : "";
    if (slot.dataset.key !== toastKey) {
      slot.dataset.key = toastKey;
      slot.replaceChildren();
      if (state.toast) {
        slot.append(el("div", { class: "toast", role: "status" },
          el("span", { class: "toast-orb", "aria-hidden": "true" }),
          el("div", {}, el("small", {}, "powerhouse · now"), el("b", {}, state.toast.title), el("span", {}, state.toast.body))));
      }
    }

    orb && orb.setJobs(live.map((j) => {
      const r = ROLES[j.role];
      return { id: j.id, color: oklchToRgb(0.78, r.chroma === 0 ? 0 : 0.14, r.hue), alert: !!j.ask };
    }));
  }

  // Timing that respects Pause and stops when a newer run starts.
  let runId = 0, paused = false;
  const CANCEL = Symbol("cancel");
  function wait(ms, id) {
    return new Promise((resolve, reject) => {
      let left = ms, last = performance.now();
      const tick = setInterval(() => {
        const now = performance.now();
        if (!paused) left -= now - last;
        last = now;
        if (id !== runId) { clearInterval(tick); reject(CANCEL); }
        else if (left <= 0) { clearInterval(tick); resolve(); }
      }, 40);
    });
  }
  function waitForApproval(ms, id) {
    return new Promise((resolve, reject) => {
      approveNow = (who) => { approveNow = null; resolve(who); };
      wait(ms, id).then(() => { if (approveNow) { approveNow = null; resolve("auto"); } }, reject);
    });
  }
  // Waits on an approval card; false when the viewer pressed Decline.
  async function decide(j, id, ms, doing) {
    const by = await waitForApproval(ms, id);
    if (by === "declined") {
      update(j, { ask: null, busy: false, done: true, text: "Declined by you. Nothing was sent" });
      await wait(1800, id);
      return false;
    }
    update(j, { ask: null, busy: true, text: `Approved by ${by === "you" ? "you" : "ana@example.com"}. ${doing}` });
    return true;
  }

  async function type(text, id) {
    state.typing = true;
    if (reduced) { state.prompt = text; renderPrompt(); await wait(600, id); }
    else for (let i = 1; i <= text.length; i++) { state.prompt = text.slice(0, i); renderPrompt(); await wait(24, id); }
    await wait(450, id);
    state.typing = false; state.prompt = ""; renderPrompt();
  }
  let seq = 0;
  const job = (role, text, extra = {}) => { const j = { id: "j" + ++seq, role, text, ...extra }; state.jobs = [j, ...state.jobs].slice(0, 3); render(); return j; };
  const update = (j, patch) => { Object.assign(j, patch); render(); };

  // Starts a job's own timeline without waiting for it, so chapters can run
  // several jobs at once. A newer run cancels it like everything else.
  const background = (fn) => fn().catch((e) => { if (e !== CANCEL) throw e; });

  const FEATURES = [
    {
      title: "Routing to roles", hue: 30,
      text: "Describe the job in plain words. Cloudflare's Clef model picks the role that fits, each with its own instructions, skills, tools and model.",
      async run(id) {
        await type("Summarize this week's Cloudflare Agents SDK releases for the team", id);
        const a = job("routing", "Clef is picking a role", { busy: true, meta: "Clef Flash" });
        const first = background(async () => {
          await wait(1500, id);
          update(a, { role: "researcher", text: "Searching the web, reading 6 release notes", meta: "Claude Opus 5.5" });
          await wait(5200, id);
          update(a, { busy: false, done: true, text: "Done. Summary ready", meta: "~$0.04 · 0:41" });
        });
        await type("Draft replies to this morning's clinic emails", id);
        const b = job("routing", "Clef is picking a role", { busy: true, meta: "Clef Flash" });
        await wait(1500, id);
        update(b, { role: "comms", text: "Drafting 3 replies", meta: "Claude Sonnet 5.5" });
        await first;
        await wait(1400, id);
        update(b, { busy: false, done: true, text: "Done. 3 drafts ready for review", meta: "~$0.02" });
        await wait(1600, id);
      },
    },
    {
      title: "Approval before anything leaves", hue: 160,
      text: "Email, writes to connected accounts and risky browser actions wait for a yes. Every approval records who gave it.",
      async run(id) {
        const m = job("marketer", "Outlining the launch post", { busy: true });
        await type("Email the SDK summary to team@example.com", id);
        const j = job("comms", "Drafting the email", { busy: true });
        await wait(1800, id);
        update(j, { busy: false, text: "Send to team@example.com: \"Agents SDK: what changed this week\"?", ask: "Approve" });
        const sent = await decide(j, id, 4200, "Sending");
        if (sent) {
          await wait(1200, id);
          update(j, { busy: false, done: true, text: "Sent to team@example.com", meta: "~$0.02" });
        }
        await wait(900, id);
        update(m, { busy: false, done: true, text: "Done. Outline ready", meta: "~$0.03" });
        await wait(1400, id);
      },
    },
    {
      title: "Schedules", hue: 60,
      text: "Put recurring work on a schedule in your team's time zone. Scheduled runs pause themselves if the daily budget is reached.",
      async run(id) {
        state.placeholder = "Scheduled: every Monday at 9:00";
        renderPrompt();
        await wait(900, id);
        const a = job("digest", "Scheduled run started", { busy: true, meta: "Mon 9:00" });
        await wait(700, id);
        const b = job("triage", "Scheduled run: weekly support summary", { busy: true, meta: "Mon 9:00" });
        await wait(2600, id);
        update(a, { busy: false, done: true, text: "Done. 4 changes worth knowing", meta: "Mon 9:00 · ~$0.03" });
        await wait(1200, id);
        update(b, { busy: false, done: true, text: "Done. 23 tickets, 2 trends", meta: "Mon 9:00 · ~$0.04" });
        await wait(1600, id);
        state.placeholder = null;
        renderPrompt();
      },
    },
    {
      title: "Connected accounts", hue: 220,
      text: "Connect Linear, Notion, Atlassian or Sentry once, then choose which roles may use them. Reads run on their own; writes ask first.",
      async run(id) {
        await type("Triage this week's new Linear issues", id);
        const j = job("triage", "Reading 14 issues in Linear", { busy: true, meta: "Linear" });
        await wait(900, id);
        await type("Check the launch plan in Notion for open questions", id);
        const n = job("marketer", "Reading the launch plan in Notion", { busy: true, meta: "Notion" });
        await wait(1200, id);
        update(j, { busy: false, text: "Create a Linear issue: \"French date formats in reminders\"?", ask: "Approve" });
        const created = await decide(j, id, 4000, "Creating");
        update(n, { busy: false, done: true, text: "Done. 2 open questions found", meta: "Notion · ~$0.02" });
        if (!created) return;
        await wait(1200, id);
        update(j, { busy: false, done: true, text: "Done. 1 issue created, 13 labeled", meta: "Linear · ~$0.05" });
        await wait(1600, id);
      },
    },
    {
      title: "A real browser you can take over", hue: 30,
      text: "For sites that need JavaScript, clicks or a login. When it hits a sign-in or a CAPTCHA, you take over in Live View, then it carries on.",
      async run(id) {
        await type("Check that our listing on the clinic directory is current", id);
        const j = job("researcher", "Opening the directory in a browser", { busy: true, meta: "Browser" });
        await wait(2200, id);
        update(j, { busy: false, text: "Needs you to sign in to the directory", ask: "Take over the browser" });
        await waitForApproval(3800, id);
        update(j, { ask: null, busy: true, text: "You signed in. Continuing" });
        await wait(1800, id);
        update(j, { busy: false, done: true, text: "Done. Listing is current, 1 phone number fixed", meta: "Browser · ~$0.06" });
        await wait(1600, id);
      },
    },
    {
      title: "Notifications", hue: 300,
      text: "Turn on notifications and powerhouse tells you when a job needs you, even with the tab closed.",
      async run(id) {
        await type("Draft the launch post, and ask me before it goes to the blog", id);
        const j = job("marketer", "Writing the launch post", { busy: true });
        await wait(2200, id);
        update(j, { busy: false, text: "Publish \"Brightbook speaks French\" to the blog?", ask: "Approve" });
        state.toast = { title: "Product marketer needs you", body: "Publish \"Brightbook speaks French\" to the blog?" };
        render();
        const ok = await decide(j, id, 4600, "Publishing");
        state.toast = null;
        render();
        if (!ok) return;
        await wait(1000, id);
        update(j, { busy: false, done: true, text: "Published to the blog", meta: "~$0.07" });
        await wait(1600, id);
      },
    },
    {
      title: "Your models, through AI Gateway", hue: 270,
      text: "Jobs run on Claude or GPT through your own AI Gateway, with your keys, logs and spend limits, or on open models with Workers AI. Clef handles the fast decisions.",
      async run(id) {
        await type("Write a short release note for the French update", id);
        const a = job("routing", "Clef is picking a role", { busy: true, meta: "Clef Flash" });
        await wait(1300, id);
        update(a, { role: "marketer", text: "Writing the release note", meta: "Claude Opus 5.5 · AI Gateway" });
        await type("Tidy up the FAQ wording", id);
        const b = job("routing", "Clef is picking a role", { busy: true, meta: "Clef Flash" });
        await wait(1300, id);
        update(b, { role: "generalist", text: "Editing 12 answers", meta: "Kimi K2.7 · Workers AI" });
        await wait(2600, id);
        update(b, { busy: false, done: true, text: "Done. 12 answers tightened", meta: "Workers AI · ~$0.01" });
        await wait(1200, id);
        update(a, { busy: false, done: true, text: "Done. Release note drafted", meta: "AI Gateway · ~$0.05" });
        await wait(1600, id);
      },
    },
    {
      title: "A whole team at once", hue: 245,
      text: "Up to ten jobs run at the same time. Only people you allow can sign in, through Cloudflare Access, and admins decide what each role may do.",
      async run(id) {
        state.jobs = [];
        render();
        const a = job("researcher", "Comparing three booking tools", { busy: true });
        await wait(600, id);
        const b = job("comms", "Replying to 3 clinic emails", { busy: true });
        await wait(600, id);
        const c = job("ops", "Checking last night's error reports", { busy: true, meta: "Sentry" });
        await wait(2400, id);
        update(c, { busy: false, done: true, text: "Done. Nothing new since Friday", meta: "Sentry · ~$0.01" });
        await wait(1000, id);
        update(b, { busy: false, text: "Send 3 replies?", ask: "Approve" });
        if (await decide(b, id, 3600, "Sending")) {
          await wait(900, id);
          update(b, { busy: false, done: true, text: "Sent 3 replies", meta: "~$0.02" });
        }
        await wait(1000, id);
        update(a, { busy: false, done: true, text: "Done. Comparison ready", meta: "~$0.05" });
        await wait(1800, id);
      },
    },
  ];

  // Feature list
  let current = 0;
  const list = $("features");
  FEATURES.forEach((f, i) => {
    const bar = el("span", { class: "bar", "aria-hidden": "true" }, el("i"));
    const btn = el("button", { type: "button", "aria-expanded": "false", onclick: () => start(i) }, el("span", { class: "dot" }), el("span", { style: "flex: 1" }, f.title), bar);
    const li = el("li", { class: "feature", style: `--hue: oklch(0.72 0.15 ${f.hue})` }, btn, el("p", { hidden: true }, f.text));
    list.append(li);
  });
  function markFeature(i) {
    current = i;
    [...list.children].forEach((li, k) => {
      const on = k === i;
      li.toggleAttribute("data-active", on);
      li.querySelector("button").setAttribute("aria-expanded", String(on));
      li.querySelector("p").hidden = !on;
      li.querySelector(".bar i").style.width = "0";
    });
  }

  // A simple progress bar for the active feature, by time in the chapter.
  let chapterStart = 0, pausedAt = 0, pausedTotal = 0;
  const EXPECTED = 14000;
  (function progress() {
    const li = list.children[current];
    if (li) {
      const elapsed = (paused ? pausedAt : performance.now()) - chapterStart - pausedTotal;
      li.querySelector(".bar i").style.width = Math.min(100, (elapsed / EXPECTED) * 100) + "%";
    }
    requestAnimationFrame(progress);
  })();

  async function start(from) {
    const id = ++runId;
    approveNow = null;
    state.toast = null; state.placeholder = null; state.prompt = ""; state.typing = false;
    // Jumping to a chapter drops jobs the interrupted one left running.
    state.jobs = state.jobs.filter((j) => j.done);
    render();
    for (let i = from; ; i = (i + 1) % FEATURES.length) {
      markFeature(i);
      chapterStart = performance.now(); pausedTotal = 0; if (paused) pausedAt = chapterStart;
      try {
        await FEATURES[i].run(id);
        await wait(400, id);
      } catch (e) {
        if (e === CANCEL) return;
        throw e;
      }
      if (id !== runId) return;
      // Keep finished jobs a moment, then let them settle out like the app.
      state.jobs = state.jobs.filter((j) => !j.done || state.jobs.indexOf(j) < 2);
      render();
    }
  }

  $("pause").addEventListener("click", (e) => {
    paused = !paused;
    if (paused) pausedAt = performance.now(); else pausedTotal += performance.now() - pausedAt;
    e.currentTarget.textContent = paused ? "Play demo" : "Pause demo";
  });

  applyTheme();
  render();
  start(0);
})();
