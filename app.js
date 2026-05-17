document.addEventListener('DOMContentLoaded', () => {
    // === STATE & INIT ===
    let state = {
        theme: localStorage.getItem('clock_theme') || 'dark',
        format12h: localStorage.getItem('clock_format') !== '24',
        alarms: JSON.parse(localStorage.getItem('clock_alarms') || '[]'),
        tasks: JSON.parse(localStorage.getItem('clock_tasks') || '{}'),
        stats: JSON.parse(localStorage.getItem('clock_stats') || '{"alarms":0,"snoozes":0,"pomos":0,"streak":0,"tasksDone":0}'),
        cities: JSON.parse(localStorage.getItem('clock_cities') || '["America/New_York","Europe/London","Asia/Kolkata"]')
    };

    let activeAlarm = null;
    let customAudioFile = null;

    initTheme();
    initTabs();
    initClock();
    initAlarms();
    initStopwatch();
    initTimer();
    initWorldClock();
    initWeather();
    initCalendar();
    initPomodoro();
    initSettings();
    initGestures();

    // === TABS ===
    function initTabs() {
        const tabs = document.querySelectorAll('.nav-links li');
        const panes = document.querySelectorAll('.tab-pane');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                panes.forEach(p => p.classList.remove('active'));

                tab.classList.add('active');
                document.getElementById(`${tab.dataset.tab}-tab`).classList.add('active');
            });
        });
    }

    // === CLOCK ===
    function initClock() {
        const timeEl = document.getElementById('main-time');
        const ampmEl = document.getElementById('main-ampm');
        const dateEl = document.getElementById('main-date');

        setInterval(() => {
            const now = new Date();

            // Time
            let h = now.getHours();
            let m = now.getMinutes().toString().padStart(2, '0');
            let s = now.getSeconds().toString().padStart(2, '0');
            let ampm = '';

            if (state.format12h) {
                ampm = h >= 12 ? 'PM' : 'AM';
                h = h % 12 || 12;
            } else {
                ampmEl.style.display = 'none';
            }

            h = h.toString().padStart(2, '0');
            timeEl.textContent = `${h}:${m}:${s}`;
            if (state.format12h) {
                ampmEl.style.display = 'inline';
                ampmEl.textContent = ampm;
            }

            // Date
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            dateEl.textContent = now.toLocaleDateString('en-US', options);

            checkAlarms(now);
        }, 1000);
    }

    // === ALARMS ===
    const alarmAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    alarmAudio.loop = true;

    function initAlarms() {
        const form = document.getElementById('alarm-form');
        const toneSelect = document.getElementById('alarm-tone');
        const fileInput = document.getElementById('alarm-file');

        toneSelect.addEventListener('change', (e) => {
            if (e.target.value === 'file') {
                fileInput.style.display = 'block';
            } else {
                fileInput.style.display = 'none';
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                customAudioFile = URL.createObjectURL(e.target.files[0]);
            }
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const time = document.getElementById('alarm-time').value;
            const challenge = document.getElementById('alarm-challenge').checked;

            state.alarms.push({
                id: Date.now().toString(),
                time,
                challenge,
                active: true,
                tone: toneSelect.value === 'file' && customAudioFile ? customAudioFile : 'default'
            });

            saveAlarms();
            renderAlarms();
        });

        document.getElementById('alarm-dismiss').addEventListener('click', dismissAlarm);
        document.getElementById('alarm-snooze').addEventListener('click', () => snoozeAlarm(5));

        renderAlarms();
    }

    function checkAlarms(now) {
        if (activeAlarm) return;

        const currentH = now.getHours().toString().padStart(2, '0');
        const currentM = now.getMinutes().toString().padStart(2, '0');
        const currentTime = `${currentH}:${currentM}`;
        const currentS = now.getSeconds();

        if (currentS === 0) {
            const firing = state.alarms.find(a => a.active && a.time === currentTime);
            if (firing) {
                triggerAlarm(firing);
            }
        }
    }

    function triggerAlarm(alarm) {
        activeAlarm = alarm;
        document.getElementById('alarm-modal').classList.remove('hidden');
        document.getElementById('alarm-time-display').textContent = alarm.time;

        if (alarm.tone !== 'default') {
            alarmAudio.src = alarm.tone;
        } else {
            alarmAudio.src = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
        }
        alarmAudio.play().catch(e => console.log('Audio play blocked'));

        const challengeDiv = document.getElementById('math-challenge');
        if (alarm.challenge) {
            challengeDiv.classList.remove('hidden');
            const n1 = Math.floor(Math.random() * 50) + 10;
            const n2 = Math.floor(Math.random() * 50) + 10;
            document.getElementById('math-problem').textContent = `${n1} + ${n2} = ?`;
            challengeDiv.dataset.answer = n1 + n2;
        } else {
            challengeDiv.classList.add('hidden');
        }

        updateStats('alarms');
    }

    function dismissAlarm() {
        if (!activeAlarm) return;

        if (activeAlarm.challenge) {
            const ans = document.getElementById('math-answer').value;
            const correct = document.getElementById('math-challenge').dataset.answer;
            if (ans !== correct) {
                alert('Wrong answer! Try again.');
                return;
            }
        }

        alarmAudio.pause();
        alarmAudio.currentTime = 0;
        document.getElementById('alarm-modal').classList.add('hidden');
        document.getElementById('math-answer').value = '';
        activeAlarm = null;
    }

    function snoozeAlarm(mins) {
        if (!activeAlarm) return;

        // Disable current, create new one 5 mins later
        const [h, m] = activeAlarm.time.split(':').map(Number);
        const date = new Date(new Date().setHours(h, m + mins));
        const newTime = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

        state.alarms.push({
            id: Date.now().toString(),
            time: newTime,
            challenge: activeAlarm.challenge,
            active: true,
            tone: activeAlarm.tone
        });

        updateStats('snoozes');
        saveAlarms();
        renderAlarms();

        // Force dismiss without challenge
        activeAlarm.challenge = false;
        dismissAlarm();
    }

    function renderAlarms() {
        const list = document.getElementById('alarm-list');
        list.innerHTML = '';

        state.alarms.forEach(a => {
            const el = document.createElement('div');
            el.className = 'alarm-item';
            el.innerHTML = `
                <div>
                    <h3>${a.time}</h3>
                    <small>${a.challenge ? '🔢 Math Challenge' : 'No challenge'}</small>
                </div>
                <div style="display:flex;gap:12px;align-items:center;">
                    <label class="switch">
                        <input type="checkbox" ${a.active ? 'checked' : ''} onchange="toggleAlarm('${a.id}')">
                    </label>
                    <button class="btn danger" onclick="deleteAlarm('${a.id}')"><i class="fas fa-trash"></i></button>
                </div>
            `;
            list.appendChild(el);
        });
    }

    window.toggleAlarm = (id) => {
        const alarm = state.alarms.find(a => a.id === id);
        if (alarm) alarm.active = !alarm.active;
        saveAlarms();
    };

    window.deleteAlarm = (id) => {
        state.alarms = state.alarms.filter(a => a.id !== id);
        saveAlarms();
        renderAlarms();
    };

    function saveAlarms() { localStorage.setItem('clock_alarms', JSON.stringify(state.alarms)); }

    // === STOPWATCH ===
    function initStopwatch() {
        let swInterval = null;
        let swTime = 0;
        const display = document.getElementById('sw-display');
        const startBtn = document.getElementById('sw-start');
        const lapBtn = document.getElementById('sw-lap');
        const resetBtn = document.getElementById('sw-reset');
        const lapsList = document.getElementById('sw-laps');

        function formatSW(ms) {
            const d = new Date(ms);
            return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}:${d.getUTCSeconds().toString().padStart(2, '0')}.${Math.floor(d.getUTCMilliseconds() / 10).toString().padStart(2, '0')}`;
        }

        startBtn.addEventListener('click', () => {
            if (swInterval) {
                clearInterval(swInterval);
                swInterval = null;
                startBtn.textContent = 'Resume';
            } else {
                const startTime = Date.now() - swTime;
                swInterval = setInterval(() => {
                    swTime = Date.now() - startTime;
                    display.textContent = formatSW(swTime);
                }, 10);
                startBtn.textContent = 'Pause';
            }
        });

        resetBtn.addEventListener('click', () => {
            clearInterval(swInterval);
            swInterval = null;
            swTime = 0;
            display.textContent = '00:00:00.00';
            startBtn.textContent = 'Start';
            lapsList.innerHTML = '';
        });

        lapBtn.addEventListener('click', () => {
            if (!swInterval) return;
            const li = document.createElement('li');
            li.textContent = `Lap: ${formatSW(swTime)}`;
            li.style.padding = '8px';
            li.style.borderBottom = '1px solid var(--border)';
            lapsList.prepend(li);
        });
    }

    // === TIMER ===
    function initTimer() {
        let tmInterval = null;
        let remain = 0;

        const inputs = document.querySelector('.timer-inputs');
        const display = document.getElementById('timer-display');
        const startBtn = document.getElementById('timer-start');
        const resetBtn = document.getElementById('timer-reset');

        function formatTimer(sec) {
            const h = Math.floor(sec / 3600);
            const m = Math.floor((sec % 3600) / 60);
            const s = sec % 60;
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }

        startBtn.addEventListener('click', () => {
            if (tmInterval) {
                clearInterval(tmInterval);
                tmInterval = null;
                startBtn.textContent = 'Resume';
            } else {
                if (remain === 0) {
                    const h = parseInt(document.getElementById('timer-h').value || 0);
                    const m = parseInt(document.getElementById('timer-m').value || 0);
                    const s = parseInt(document.getElementById('timer-s').value || 0);
                    remain = (h * 3600) + (m * 60) + s;
                    if (remain <= 0) return;
                    inputs.classList.add('hidden');
                    display.classList.remove('hidden');
                    resetBtn.classList.remove('hidden');
                }

                startBtn.textContent = 'Pause';
                tmInterval = setInterval(() => {
                    remain--;
                    display.textContent = formatTimer(remain);
                    if (remain <= 0) {
                        clearInterval(tmInterval);
                        tmInterval = null;
                        startBtn.textContent = 'Start';
                        new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play();
                        alert('Timer Finished!');
                        resetTimer();
                    }
                }, 1000);
            }
        });

        resetBtn.addEventListener('click', resetTimer);

        function resetTimer() {
            clearInterval(tmInterval);
            tmInterval = null;
            remain = 0;
            display.textContent = '00:00:00';
            inputs.classList.remove('hidden');
            display.classList.add('hidden');
            resetBtn.classList.add('hidden');
            startBtn.textContent = 'Start';
        }
    }

    // === WORLD CLOCK ===
    function initWorldClock() {
        const list = document.getElementById('wc-list');
        const addBtn = document.getElementById('wc-add');
        const select = document.getElementById('wc-city-select');

        function renderWC() {
            list.innerHTML = '';
            const now = new Date();
            state.cities.forEach(tz => {
                const cityStr = tz.split('/')[1].replace('_', ' ');
                let timeStr = 'Error';
                try {
                    timeStr = now.toLocaleTimeString('en-US', { timeZone: tz, hour12: state.format12h });
                } catch (e) { }

                const el = document.createElement('div');
                el.className = 'card wc-item';
                el.innerHTML = `
                    <div style="text-align:center; width:100%">
                        <h3>${cityStr}</h3>
                        <div class="large-text" style="font-size:2rem; margin:10px 0; color:var(--primary); font-family:var(--font-mono)">${timeStr}</div>
                        <button class="btn danger" style="padding:4px 8px; font-size:0.8rem" onclick="removeCity('${tz}')">Remove</button>
                    </div>
                `;
                list.appendChild(el);
            });
        }

        window.removeCity = (tz) => {
            state.cities = state.cities.filter(c => c !== tz);
            localStorage.setItem('clock_cities', JSON.stringify(state.cities));
            renderWC();
        };

        addBtn.addEventListener('click', () => {
            const tz = select.value;
            if (!state.cities.includes(tz)) {
                state.cities.push(tz);
                localStorage.setItem('clock_cities', JSON.stringify(state.cities));
                renderWC();
            }
        });

        setInterval(renderWC, 1000);
        renderWC();
    }

    // === WEATHER ===
    function initWeather() {
        const container = document.getElementById('weather-container');

        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(async (pos) => {
                const { latitude, longitude } = pos.coords;
                try {
                    // Open-Meteo free API
                    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`);
                    const data = await res.json();

                    const temp = data.current.temperature_2m;
                    const code = data.current.weather_code;

                    let icon = 'fa-sun';
                    let desc = 'Clear';
                    if (code >= 1 && code <= 3) { icon = 'fa-cloud-sun'; desc = 'Partly Cloudy'; }
                    if (code >= 45 && code <= 48) { icon = 'fa-smog'; desc = 'Fog'; }
                    if (code >= 51 && code <= 67) { icon = 'fa-cloud-rain'; desc = 'Rain'; }
                    if (code >= 71 && code <= 77) { icon = 'fa-snowflake'; desc = 'Snow'; }
                    if (code >= 95) { icon = 'fa-bolt'; desc = 'Thunderstorm'; }

                    container.innerHTML = `
                        <i class="fas ${icon} weather-icon"></i>
                        <div>
                            <div class="weather-temp">${temp}°C</div>
                            <div class="weather-desc">${desc} (Lat: ${latitude.toFixed(2)}, Lon: ${longitude.toFixed(2)})</div>
                        </div>
                    `;
                } catch (e) {
                    container.innerHTML = '<div>Failed to load weather data.</div>';
                }
            }, (err) => {
                container.innerHTML = '<div>Location access denied or unavailable.</div>';
            });
        } else {
            container.innerHTML = '<div>Geolocation not supported.</div>';
        }
    }

    // === CALENDAR & TASKS ===
    function initCalendar() {
        let d = new Date();
        let currMonth = d.getMonth();
        let currYear = d.getFullYear();
        let selectedDateStr = d.toISOString().split('T')[0];

        const daysEl = document.getElementById('cal-days');
        const monthYearEl = document.getElementById('cal-month-year');
        const taskDateEl = document.getElementById('task-date');
        const taskForm = document.getElementById('task-form');
        const taskInput = document.getElementById('task-input');
        const taskList = document.getElementById('task-list');

        function renderCal() {
            daysEl.innerHTML = '';
            const dt = new Date(currYear, currMonth, 1);
            monthYearEl.textContent = dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

            const daysArr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            daysArr.forEach(day => {
                const el = document.createElement('div');
                el.className = 'cal-day header';
                el.textContent = day;
                daysEl.appendChild(el);
            });

            const firstDay = dt.getDay();
            const daysInMonth = new Date(currYear, currMonth + 1, 0).getDate();

            for (let i = 0; i < firstDay; i++) {
                const el = document.createElement('div');
                daysEl.appendChild(el);
            }

            for (let i = 1; i <= daysInMonth; i++) {
                const el = document.createElement('div');
                el.className = 'cal-day';
                el.textContent = i;

                const curStr = `${currYear}-${String(currMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

                if (curStr === selectedDateStr) el.classList.add('active');

                el.addEventListener('click', () => {
                    selectedDateStr = curStr;
                    taskDateEl.textContent = new Date(currYear, currMonth, i).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    renderCal();
                    renderTasks();
                });
                daysEl.appendChild(el);
            }
        }

        document.getElementById('cal-prev').addEventListener('click', () => {
            currMonth--;
            if (currMonth < 0) { currMonth = 11; currYear--; }
            renderCal();
        });

        document.getElementById('cal-next').addEventListener('click', () => {
            currMonth++;
            if (currMonth > 11) { currMonth = 0; currYear++; }
            renderCal();
        });

        function renderTasks() {
            taskList.innerHTML = '';
            const tasks = state.tasks[selectedDateStr] || [];
            tasks.forEach((t, idx) => {
                const li = document.createElement('li');
                li.className = 'task-item';
                li.innerHTML = `
                    <div style="flex:1; text-decoration: ${t.done ? 'line-through' : 'none'}; color: ${t.done ? 'var(--text-muted)' : 'inherit'}">
                        ${t.text}
                    </div>
                    <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleTask(${idx})">
                    <button class="btn danger" style="padding:4px;" onclick="deleteTask(${idx})"><i class="fas fa-trash"></i></button>
                `;
                taskList.appendChild(li);
            });
        }

        taskForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = taskInput.value.trim();
            if (!text) return;
            if (!state.tasks[selectedDateStr]) state.tasks[selectedDateStr] = [];
            state.tasks[selectedDateStr].push({ text, done: false });
            localStorage.setItem('clock_tasks', JSON.stringify(state.tasks));
            taskInput.value = '';
            renderTasks();
        });

        window.toggleTask = (idx) => {
            state.tasks[selectedDateStr][idx].done = !state.tasks[selectedDateStr][idx].done;
            localStorage.setItem('clock_tasks', JSON.stringify(state.tasks));
            renderTasks();
        };

        window.deleteTask = (idx) => {
            state.tasks[selectedDateStr].splice(idx, 1);
            localStorage.setItem('clock_tasks', JSON.stringify(state.tasks));
            renderTasks();
        };

        renderCal();
        renderTasks();
    }

    // === POMODORO ===
    function initPomodoro() {
        let pTimer = null;
        let isFocus = true;
        let pRemain = 25 * 60;

        const modeEl = document.getElementById('pomo-mode');
        const display = document.getElementById('pomo-display');
        const startBtn = document.getElementById('pomo-start');
        const resetBtn = document.getElementById('pomo-reset');

        function formatPomo(s) {
            return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
        }

        startBtn.addEventListener('click', () => {
            if (pTimer) {
                clearInterval(pTimer);
                pTimer = null;
                startBtn.textContent = 'Resume';
            } else {
                startBtn.textContent = 'Pause';
                pTimer = setInterval(() => {
                    pRemain--;
                    display.textContent = formatPomo(pRemain);
                    if (pRemain <= 0) {
                        clearInterval(pTimer);
                        pTimer = null;
                        new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play();

                        if (isFocus) {
                            updateStats('pomos');
                            isFocus = false;
                            pRemain = parseInt(document.getElementById('pomo-break-len').value) * 60;
                            modeEl.textContent = 'Break Mode';
                            modeEl.style.color = 'var(--primary)';
                        } else {
                            isFocus = true;
                            pRemain = parseInt(document.getElementById('pomo-focus-len').value) * 60;
                            modeEl.textContent = 'Focus Mode';
                            modeEl.style.color = 'inherit';
                        }
                        display.textContent = formatPomo(pRemain);
                        startBtn.textContent = 'Start';
                        alert(`Time's up! Starting ${isFocus ? 'Focus' : 'Break'} Mode.`);
                    }
                }, 1000);
            }
        });

        resetBtn.addEventListener('click', () => {
            clearInterval(pTimer);
            pTimer = null;
            isFocus = true;
            pRemain = parseInt(document.getElementById('pomo-focus-len').value) * 60;
            display.textContent = formatPomo(pRemain);
            modeEl.textContent = 'Focus Mode';
            modeEl.style.color = 'inherit';
            startBtn.textContent = 'Start';
        });
    }

    // === SETTINGS & STATS ===
    function initTheme() {
        document.documentElement.setAttribute('data-theme', state.theme);
    }

    function updateStats(key) {
        state.stats[key] = (state.stats[key] || 0) + 1;
        localStorage.setItem('clock_stats', JSON.stringify(state.stats));
        // Track daily focus for analytics
        if (key === 'pomos') {
            const today = new Date().toISOString().split('T')[0];
            const log = JSON.parse(localStorage.getItem('clock_focus_log') || '{}');
            log[today] = (log[today] || 0) + 1;
            localStorage.setItem('clock_focus_log', JSON.stringify(log));
        }
        renderStats();
    }

    function renderStats() {
        const el = (id) => document.getElementById(id);
        if(el('a-streak')) el('a-streak').textContent = state.stats.streak || 0;
        if(el('a-pomos')) el('a-pomos').textContent = state.stats.pomos || 0;
        if(el('a-focus-hrs')) el('a-focus-hrs').textContent = ((state.stats.pomos || 0) * 25 / 60).toFixed(1) + 'h';
        if(el('a-tasks-done')) el('a-tasks-done').textContent = state.stats.tasksDone || 0;
        if(el('streak-count')) el('streak-count').textContent = state.stats.streak || 0;
        renderHeatmap();
        renderBarChart();
    }

    function renderHeatmap() {
        const hm = document.getElementById('heatmap');
        if (!hm) return;
        hm.innerHTML = '';
        const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
        days.forEach(d => { const l = document.createElement('div'); l.className='heatmap-label'; l.textContent=d; hm.appendChild(l); });
        const focusData = JSON.parse(localStorage.getItem('clock_focus_log') || '{}');
        for (let i = 6; i >= 0; i--) {
            const dt = new Date(); dt.setDate(dt.getDate() - i);
            const key = dt.toISOString().split('T')[0];
            const val = focusData[key] || 0;
            const cell = document.createElement('div');
            cell.className = 'heatmap-cell' + (val > 3 ? ' l4' : val > 2 ? ' l3' : val > 1 ? ' l2' : val > 0 ? ' l1' : '');
            cell.title = `${key}: ${val} pomodoros`;
            hm.appendChild(cell);
        }
    }

    function renderBarChart() {
        const bc = document.getElementById('bar-chart');
        if (!bc) return;
        bc.innerHTML = '';
        const focusData = JSON.parse(localStorage.getItem('clock_focus_log') || '{}');
        const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        let maxVal = 1;
        const entries = [];
        for (let i = 6; i >= 0; i--) {
            const dt = new Date(); dt.setDate(dt.getDate() - i);
            const key = dt.toISOString().split('T')[0];
            const val = focusData[key] || 0;
            if (val > maxVal) maxVal = val;
            entries.push({ day: dayNames[dt.getDay()], val });
        }
        entries.forEach(e => {
            const col = document.createElement('div'); col.className = 'bar-col';
            const bar = document.createElement('div'); bar.className = 'bar';
            bar.style.height = Math.max(4, (e.val / maxVal) * 120) + 'px';
            const lbl = document.createElement('div'); lbl.className = 'bar-label'; lbl.textContent = e.day;
            const vl = document.createElement('div'); vl.className = 'bar-val'; vl.textContent = e.val;
            col.appendChild(vl); col.appendChild(bar); col.appendChild(lbl);
            bc.appendChild(col);
        });
    }

    function initSettings() {
        const themeSel = document.getElementById('theme-select');
        const formatSel = document.getElementById('time-format');
        themeSel.value = state.theme;
        formatSel.value = state.format12h ? '12' : '24';

        themeSel.addEventListener('change', (e) => {
            state.theme = e.target.value;
            localStorage.setItem('clock_theme', state.theme);
            initTheme();
        });

        formatSel.addEventListener('change', (e) => {
            state.format12h = e.target.value === '12';
            localStorage.setItem('clock_format', state.format12h ? '12' : '24');
        });

        document.getElementById('toggle-particles')?.addEventListener('change', (e) => {
            document.getElementById('particle-canvas').style.display = e.target.checked ? '' : 'none';
        });

        document.getElementById('toggle-sky')?.addEventListener('change', (e) => {
            document.getElementById('sky-overlay').style.display = e.target.checked ? '' : 'none';
        });

        document.getElementById('reset-all')?.addEventListener('click', () => {
            if(confirm('Reset ALL data? This cannot be undone.')) {
                localStorage.clear();
                location.reload();
            }
        });

        document.getElementById('show-shortcuts')?.addEventListener('click', () => {
            document.getElementById('shortcuts-modal').classList.remove('hidden');
        });
        document.getElementById('close-shortcuts')?.addEventListener('click', () => {
            document.getElementById('shortcuts-modal').classList.add('hidden');
        });

        renderStats();
        initVoice();
    }

    function initVoice() {
        const voiceBtn = document.getElementById('toggle-voice');
        const voiceStatus = document.getElementById('voice-status');
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recognition = new SpeechRec();
            recognition.continuous = false; recognition.lang = 'en-US';
            voiceBtn.addEventListener('click', () => { recognition.start(); voiceStatus.textContent = 'Listening...'; voiceStatus.style.color = 'var(--primary)'; });
            recognition.onresult = (e) => {
                const txt = e.results[0][0].transcript.toLowerCase();
                voiceStatus.textContent = `Heard: "${txt}"`; voiceStatus.style.color = 'inherit';
                if (txt.includes('stop') || txt.includes('dismiss')) { if (activeAlarm) dismissAlarm(); }
                else if (txt.includes('snooze')) { if (activeAlarm) snoozeAlarm(5); }
            };
            recognition.onerror = () => { voiceStatus.textContent = 'Error. Try again.'; };
        } else {
            voiceBtn.disabled = true; voiceStatus.textContent = 'Speech not supported.';
        }
    }

    // === PARTICLES ===
    function initParticles() {
        const canvas = document.getElementById('particle-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let particles = [];
        function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
        resize(); window.addEventListener('resize', resize);
        for (let i = 0; i < 60; i++) {
            particles.push({ x: Math.random()*canvas.width, y: Math.random()*canvas.height, r: Math.random()*2+0.5, dx: (Math.random()-0.5)*0.4, dy: (Math.random()-0.5)*0.4, o: Math.random()*0.5+0.1 });
        }
        function draw() {
            ctx.clearRect(0,0,canvas.width,canvas.height);
            const cs = getComputedStyle(document.documentElement);
            const col = cs.getPropertyValue('--primary').trim() || '#6c5ce7';
            particles.forEach(p => {
                ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
                ctx.fillStyle = col; ctx.globalAlpha = p.o; ctx.fill();
                p.x += p.dx; p.y += p.dy;
                if(p.x<0||p.x>canvas.width) p.dx*=-1;
                if(p.y<0||p.y>canvas.height) p.dy*=-1;
            });
            ctx.globalAlpha = 1;
            requestAnimationFrame(draw);
        }
        draw();
    }

    // === GREETING & DAY PROGRESS ===
    function initGreeting() {
        setInterval(() => {
            const h = new Date().getHours();
            const g = document.getElementById('greeting');
            if(g) g.textContent = h<5?'Good Night 🌙':h<12?'Good Morning ☀️':h<17?'Good Afternoon 🌤️':h<21?'Good Evening 🌅':'Good Night 🌙';
            const dp = document.getElementById('day-progress');
            if(dp) dp.textContent = Math.round(((h*60+new Date().getMinutes())/1440)*100)+'%';
            const sr = document.getElementById('sunrise-time');
            const ss = document.getElementById('sunset-time');
            if(sr) sr.textContent = '06:15';
            if(ss) ss.textContent = '18:45';
            // Sky overlay
            const sky = document.getElementById('sky-overlay');
            if(sky) {
                if(h>=6&&h<8) sky.style.background='linear-gradient(to top,rgba(255,150,50,0.2),transparent)';
                else if(h>=8&&h<17) sky.style.background='linear-gradient(to top,rgba(135,206,250,0.08),transparent)';
                else if(h>=17&&h<20) sky.style.background='linear-gradient(to top,rgba(255,100,50,0.15),rgba(128,0,128,0.08))';
                else sky.style.background='linear-gradient(to top,rgba(10,10,40,0.1),transparent)';
            }
            // Clock rings
            const now = new Date();
            const secFrac = now.getSeconds()/60;
            const minFrac = now.getMinutes()/60;
            const hrFrac = (now.getHours()%12)/12;
            const secR=document.getElementById('ring-sec'),minR=document.getElementById('ring-min'),hrR=document.getElementById('ring-hr');
            if(secR) secR.style.strokeDashoffset = 565.5*(1-secFrac);
            if(minR) minR.style.strokeDashoffset = 502.6*(1-minFrac);
            if(hrR) hrR.style.strokeDashoffset = 439.8*(1-hrFrac);
        }, 1000);
    }

    // === AMBIENT SOUNDS (Web Audio API) ===
    function initAmbient() {
        const grid = document.getElementById('ambient-grid');
        if (!grid) return;
        const sounds = [
            {name:'Rain',icon:'🌧️',type:'rain'},{name:'Ocean',icon:'🌊',type:'ocean'},
            {name:'Wind',icon:'💨',type:'wind'},{name:'Fire',icon:'🔥',type:'fire'},
            {name:'Birds',icon:'🐦',type:'birds'},{name:'Thunder',icon:'⛈️',type:'thunder'},
            {name:'Cafe',icon:'☕',type:'cafe'},{name:'Night',icon:'🦗',type:'night'}
        ];
        const audioCtx = new (window.AudioContext||window.webkitAudioContext)();
        const activeSounds = {};

        function makeNoise(type) {
            const bufferSize = 2 * audioCtx.sampleRate;
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = (Math.random()*2-1);
            const src = audioCtx.createBufferSource(); src.buffer = buffer; src.loop = true;
            const gain = audioCtx.createGain(); gain.gain.value = 0.15;
            const filter = audioCtx.createBiquadFilter();
            switch(type) {
                case 'rain': filter.type='lowpass'; filter.frequency.value=800; break;
                case 'ocean': filter.type='lowpass'; filter.frequency.value=400; break;
                case 'wind': filter.type='bandpass'; filter.frequency.value=300; filter.Q.value=0.5; break;
                case 'fire': filter.type='lowpass'; filter.frequency.value=600; break;
                case 'thunder': filter.type='lowpass'; filter.frequency.value=200; break;
                case 'birds': filter.type='highpass'; filter.frequency.value=2000; gain.gain.value=0.05; break;
                case 'cafe': filter.type='bandpass'; filter.frequency.value=1000; filter.Q.value=0.3; break;
                case 'night': filter.type='bandpass'; filter.frequency.value=500; filter.Q.value=0.2; gain.gain.value=0.08; break;
            }
            src.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
            src.start(); return {src, gain, filter};
        }

        sounds.forEach(s => {
            const card = document.createElement('div');
            card.className = 'ambient-card';
            card.innerHTML = `<span class="ambient-icon">${s.icon}</span><span class="ambient-name">${s.name}</span><input type="range" class="ambient-slider slider" min="0" max="100" value="30">`;
            const slider = card.querySelector('.ambient-slider');
            card.addEventListener('click', (e) => {
                if(e.target === slider) return;
                audioCtx.resume();
                if(activeSounds[s.type]) {
                    activeSounds[s.type].src.stop();
                    delete activeSounds[s.type];
                    card.classList.remove('active');
                } else {
                    activeSounds[s.type] = makeNoise(s.type);
                    activeSounds[s.type].gain.gain.value = slider.value/100*0.3;
                    card.classList.add('active');
                }
            });
            slider.addEventListener('input', () => {
                if(activeSounds[s.type]) activeSounds[s.type].gain.gain.value = slider.value/100*0.3;
            });
            grid.appendChild(card);
        });

        document.getElementById('master-volume')?.addEventListener('input', (e) => {
            const v = e.target.value/100;
            Object.values(activeSounds).forEach(s => s.gain.gain.value = v*0.3);
        });
    }

    // === KEYBOARD SHORTCUTS ===
    function initKeyboard() {
        document.addEventListener('keydown', (e) => {
            if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT'||e.target.tagName==='TEXTAREA') return;
            const tabs = document.querySelectorAll('.nav-links li');
            const panes = document.querySelectorAll('.tab-pane');
            function switchTab(idx) {
                if(idx>=tabs.length) return;
                tabs.forEach(t=>t.classList.remove('active'));
                panes.forEach(p=>p.classList.remove('active'));
                tabs[idx].classList.add('active');
                document.getElementById(`${tabs[idx].dataset.tab}-tab`).classList.add('active');
            }
            if(e.key>='1'&&e.key<='9') { e.preventDefault(); switchTab(parseInt(e.key)-1); }
            else if(e.key===' ') {
                e.preventDefault();
                const active = document.querySelector('.tab-pane.active');
                if(active?.id==='stopwatch-tab') document.getElementById('sw-start')?.click();
                else if(active?.id==='timer-tab') document.getElementById('timer-start')?.click();
                else if(active?.id==='pomodoro-tab') document.getElementById('pomo-start')?.click();
            }
            else if(e.key==='r'||e.key==='R') {
                const active = document.querySelector('.tab-pane.active');
                if(active?.id==='stopwatch-tab') document.getElementById('sw-reset')?.click();
                else if(active?.id==='timer-tab') document.getElementById('timer-reset')?.click();
                else if(active?.id==='pomodoro-tab') document.getElementById('pomo-reset')?.click();
            }
            else if(e.key==='l'||e.key==='L') document.getElementById('sw-lap')?.click();
            else if(e.key==='t'||e.key==='T') {
                const sel = document.getElementById('theme-select');
                const themes = ['dark','light','neon','ocean','sunset'];
                const cur = themes.indexOf(state.theme);
                sel.value = themes[(cur+1)%themes.length];
                sel.dispatchEvent(new Event('change'));
            }
            else if(e.key==='f'||e.key==='F') { if(!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); }
            else if(e.key==='?') document.getElementById('shortcuts-modal')?.classList.remove('hidden');
            else if(e.key==='Escape') { document.getElementById('shortcuts-modal')?.classList.add('hidden'); document.getElementById('alarm-modal')?.classList.add('hidden'); }
        });
        setTimeout(()=>{ const h=document.getElementById('shortcut-hint'); if(h) h.style.opacity='0'; }, 5000);
    }

    // === MOBILE NAV ===
    function initMobileNav() {
        document.querySelectorAll('.mobile-nav button').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.mobile-nav button').forEach(b=>b.classList.remove('active'));
                btn.classList.add('active');
                document.querySelectorAll('.nav-links li').forEach(t=>t.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('active'));
                const li = document.querySelector(`.nav-links li[data-tab="${btn.dataset.tab}"]`);
                if(li) li.classList.add('active');
                document.getElementById(`${btn.dataset.tab}-tab`)?.classList.add('active');
            });
        });
    }

    // === GESTURES ===
    function initGestures() {
        if (typeof DeviceMotionEvent !== 'undefined') {
            let lastUpdate=0, lastX=null, lastY=null, lastZ=null;
            window.addEventListener('devicemotion', (e) => {
                if (!activeAlarm) return;
                const curTime = Date.now();
                if ((curTime-lastUpdate)>100) {
                    const diffTime=(curTime-lastUpdate); lastUpdate=curTime;
                    const acc=e.accelerationIncludingGravity; if(!acc) return;
                    if (lastX!==null) {
                        const speed=Math.abs(acc.x+acc.y+acc.z-lastX-lastY-lastZ)/diffTime*10000;
                        if(speed>15) { snoozeAlarm(5); }
                    }
                    lastX=acc.x; lastY=acc.y; lastZ=acc.z;
                }
            });
        }
    }

    // === NOTIFICATIONS ===
    function initNotifications() {
        if('Notification' in window && Notification.permission==='default') {
            Notification.requestPermission();
        }
    }

    // === XP & LEVELING SYSTEM ===
    function getXP() { return JSON.parse(localStorage.getItem('clock_xp') || '{"xp":0,"level":1}'); }
    function saveXP(data) { localStorage.setItem('clock_xp', JSON.stringify(data)); }
    function xpForLevel(lv) { return lv * 100; }

    function awardXP(amount) {
        const data = getXP();
        data.xp += amount;
        while (data.xp >= xpForLevel(data.level)) {
            data.xp -= xpForLevel(data.level);
            data.level++;
        }
        saveXP(data);
        renderXP(data);
        showXPToast(amount);
    }

    function renderXP(data) {
        if (!data) data = getXP();
        const needed = xpForLevel(data.level);
        const pct = Math.min(100, (data.xp / needed) * 100);
        const el = (id) => document.getElementById(id);
        if(el('xp-level')) el('xp-level').textContent = data.level;
        if(el('xp-fill')) el('xp-fill').style.width = pct + '%';
        if(el('xp-current')) el('xp-current').textContent = data.xp;
        if(el('xp-next')) el('xp-next').textContent = needed;
        if(el('mini-xp')) el('mini-xp').textContent = (data.level-1)*100 + data.xp;
    }

    function showXPToast(amount) {
        const toast = document.getElementById('xp-toast');
        const amtEl = document.getElementById('xp-toast-amount');
        if (!toast || !amtEl) return;
        amtEl.textContent = amount;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 2000);
    }

    // === MOTIVATIONAL QUOTES ===
    function initQuotes() {
        const quotes = [
            {t:"The only way to do great work is to love what you do.",a:"Steve Jobs"},
            {t:"It is during our darkest moments that we must focus to see the light.",a:"Aristotle"},
            {t:"Time you enjoy wasting is not wasted time.",a:"Marthe Troly-Curtin"},
            {t:"The secret of getting ahead is getting started.",a:"Mark Twain"},
            {t:"Focus on being productive instead of busy.",a:"Tim Ferriss"},
            {t:"Your time is limited, don't waste it living someone else's life.",a:"Steve Jobs"},
            {t:"The bad news is time flies. The good news is you're the pilot.",a:"Michael Altshuler"},
            {t:"Lost time is never found again.",a:"Benjamin Franklin"},
            {t:"Don't count the days, make the days count.",a:"Muhammad Ali"},
            {t:"Discipline is choosing between what you want now and what you want most.",a:"Abraham Lincoln"},
            {t:"The way to get started is to quit talking and begin doing.",a:"Walt Disney"},
            {t:"Success is not final, failure is not fatal: it is the courage to continue that counts.",a:"Winston Churchill"},
            {t:"Believe you can and you're halfway there.",a:"Theodore Roosevelt"},
            {t:"It always seems impossible until it's done.",a:"Nelson Mandela"},
            {t:"You don't have to be great to start, but you have to start to be great.",a:"Zig Ziglar"}
        ];
        function setQuote() {
            const q = quotes[Math.floor(Math.random()*quotes.length)];
            const qt = document.getElementById('quote-text');
            const qa = document.getElementById('quote-author');
            if(qt) qt.textContent = q.t;
            if(qa) qa.textContent = '— ' + q.a;
        }
        setQuote();
        setInterval(setQuote, 30000);
    }

    // === BREATHING EXERCISE ===
    function initBreathing() {
        const modes = {
            '478': { name:'4-7-8 Relaxing', steps:[{act:'Inhale',dur:4},{act:'Hold',dur:7},{act:'Exhale',dur:8}], info:'Inhale 4s → Hold 7s → Exhale 8s' },
            'box': { name:'Box Breathing', steps:[{act:'Inhale',dur:4},{act:'Hold',dur:4},{act:'Exhale',dur:4},{act:'Hold',dur:4}], info:'Inhale 4s → Hold 4s → Exhale 4s → Hold 4s' },
            'energize': { name:'Energize', steps:[{act:'Inhale',dur:2},{act:'Exhale',dur:2}], info:'Quick Inhale 2s → Exhale 2s' }
        };
        let currentMode = '478';
        let breathInterval = null;
        let breathTimeout = null;
        let cycleCount = 0;
        let totalSeconds = 0;

        const circle = document.getElementById('breath-circle');
        const instruction = document.getElementById('breath-instruction');
        const countEl = document.getElementById('breath-count');
        const infoEl = document.getElementById('breath-info');
        const startBtn = document.getElementById('breath-start');
        const resetBtn = document.getElementById('breath-reset');
        const ringEl = document.getElementById('ring-breath');

        document.querySelectorAll('.breath-mode').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.breath-mode').forEach(b=>b.classList.remove('active'));
                btn.classList.add('active');
                currentMode = btn.dataset.mode;
                if(infoEl) infoEl.textContent = modes[currentMode].info;
                resetBreathing();
            });
        });

        function runCycle() {
            const steps = modes[currentMode].steps;
            let stepIdx = 0;

            function doStep() {
                if (!breathInterval) return;
                const step = steps[stepIdx];
                if(instruction) instruction.textContent = step.act;
                if(circle) { circle.className = 'breath-circle ' + step.act.toLowerCase(); }

                let countdown = step.dur;
                if(countEl) countEl.textContent = countdown;
                if(ringEl) {
                    const totalDur = steps.reduce((a,s)=>a+s.dur, 0);
                    const elapsed = steps.slice(0,stepIdx).reduce((a,s)=>a+s.dur,0);
                    ringEl.style.strokeDashoffset = 565.5 * (1 - (elapsed+step.dur)/totalDur);
                }

                const countdownInt = setInterval(() => {
                    countdown--;
                    totalSeconds++;
                    if(countEl) countEl.textContent = countdown > 0 ? countdown : '';
                    if(countdown <= 0) {
                        clearInterval(countdownInt);
                        stepIdx++;
                        if(stepIdx >= steps.length) {
                            cycleCount++;
                            stepIdx = 0;
                            awardXP(5);
                        }
                        if(breathInterval) breathTimeout = setTimeout(doStep, 200);
                    }
                }, 1000);
                breathInterval = countdownInt;
            }
            doStep();
        }

        startBtn?.addEventListener('click', () => {
            if(breathInterval) {
                clearInterval(breathInterval);
                clearTimeout(breathTimeout);
                breathInterval = null;
                startBtn.textContent = 'Resume';
            } else {
                breathInterval = true;
                startBtn.textContent = 'Pause';
                runCycle();
            }
        });

        resetBtn?.addEventListener('click', resetBreathing);

        function resetBreathing() {
            clearInterval(breathInterval);
            clearTimeout(breathTimeout);
            breathInterval = null;
            if(instruction) instruction.textContent = 'Press Start';
            if(countEl) countEl.textContent = '';
            if(circle) circle.className = 'breath-circle';
            if(startBtn) startBtn.textContent = 'Start';
            if(ringEl) ringEl.style.strokeDashoffset = 565.5;
            const bs = JSON.parse(localStorage.getItem('clock_breath') || '{"sessions":0,"totalMin":0}');
            bs.sessions += cycleCount;
            bs.totalMin += Math.round(totalSeconds/60);
            localStorage.setItem('clock_breath', JSON.stringify(bs));
            document.getElementById('breath-sessions').textContent = bs.sessions;
            document.getElementById('breath-total-time').textContent = bs.totalMin + 'm';
            cycleCount = 0;
            totalSeconds = 0;
        }

        const bs = JSON.parse(localStorage.getItem('clock_breath') || '{"sessions":0,"totalMin":0}');
        if(document.getElementById('breath-sessions')) document.getElementById('breath-sessions').textContent = bs.sessions;
        if(document.getElementById('breath-total-time')) document.getElementById('breath-total-time').textContent = bs.totalMin + 'm';
    }

    // === TIME CAPSULE ===
    function initTimeCapsule() {
        let capsules = JSON.parse(localStorage.getItem('clock_capsules') || '[]');
        const form = document.getElementById('capsule-form');
        const list = document.getElementById('capsule-list');
        const dateInput = document.getElementById('capsule-date');
        const timeInput = document.getElementById('capsule-time');

        // Default to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        if(dateInput) dateInput.value = tomorrow.toISOString().split('T')[0];
        if(timeInput) timeInput.value = '09:00';

        form?.addEventListener('submit', (e) => {
            e.preventDefault();
            const msg = document.getElementById('capsule-message').value.trim();
            const date = dateInput.value;
            const time = timeInput.value;
            if(!msg || !date || !time) return;

            capsules.push({
                id: Date.now().toString(),
                message: msg,
                unlockAt: new Date(`${date}T${time}`).getTime(),
                createdAt: Date.now()
            });
            localStorage.setItem('clock_capsules', JSON.stringify(capsules));
            document.getElementById('capsule-message').value = '';
            renderCapsules();
            awardXP(15);
        });

        function renderCapsules() {
            if(!list) return;
            list.innerHTML = '';
            const now = Date.now();
            capsules.sort((a,b) => a.unlockAt - b.unlockAt);

            capsules.forEach(c => {
                const isUnlocked = now >= c.unlockAt;
                const unlockDate = new Date(c.unlockAt);
                const createdDate = new Date(c.createdAt);
                const el = document.createElement('div');
                el.className = 'capsule-item ' + (isUnlocked ? 'unlocked' : 'locked');
                el.innerHTML = `
                    <button class="capsule-delete" onclick="deleteCapsule('${c.id}')"><i class="fas fa-trash"></i></button>
                    <div class="capsule-header">
                        <span>Created: ${createdDate.toLocaleDateString()}</span>
                        <span class="capsule-status ${isUnlocked?'unlocked':'locked'}">
                            <i class="fas fa-${isUnlocked?'lock-open':'lock'}"></i>
                            ${isUnlocked ? 'Unlocked!' : 'Opens ' + unlockDate.toLocaleDateString() + ' ' + unlockDate.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                        </span>
                    </div>
                    <div class="capsule-msg">${isUnlocked ? c.message : '🔒 This message is sealed until ' + unlockDate.toLocaleDateString()}</div>
                `;
                list.appendChild(el);

                if(isUnlocked && !c.notified) {
                    c.notified = true;
                    localStorage.setItem('clock_capsules', JSON.stringify(capsules));
                    if('Notification' in window && Notification.permission==='granted') {
                        new Notification('⏰ Time Capsule Opened!', {body: c.message.substring(0,80)+'...'});
                    }
                    awardXP(25);
                }
            });
        }

        window.deleteCapsule = (id) => {
            capsules = capsules.filter(c => c.id !== id);
            localStorage.setItem('clock_capsules', JSON.stringify(capsules));
            renderCapsules();
        };

        renderCapsules();
        setInterval(renderCapsules, 10000);
    }

    // === ZEN FOCUS MODE ===
    function initZenMode() {
        const fab = document.getElementById('zen-fab');
        const overlay = document.getElementById('zen-overlay');
        const exitBtn = document.getElementById('zen-exit');
        const zenTime = document.getElementById('zen-time');
        const zenDate = document.getElementById('zen-date');
        const zenQuote = document.getElementById('zen-quote');
        const zenCanvas = document.getElementById('zen-canvas');
        let zenInterval = null;

        const quotes = [
            "Be present. Be grateful. Be still.",
            "In the silence, find your strength.",
            "Every moment is a fresh beginning.",
            "Peace comes from within. Do not seek it without.",
            "The present moment is filled with joy and happiness. If you are attentive, you will see it.",
            "Breathe. Let go. And remind yourself that this very moment is the only one you know you have for sure."
        ];

        function startZen() {
            overlay?.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
            if(zenQuote) zenQuote.textContent = '"' + quotes[Math.floor(Math.random()*quotes.length)] + '"';
            updateZenTime();
            zenInterval = setInterval(updateZenTime, 1000);
            initZenParticles();
            awardXP(10);
        }

        function updateZenTime() {
            const now = new Date();
            if(zenTime) zenTime.textContent = now.toLocaleTimeString('en-US', {hour:'2-digit',minute:'2-digit',second:'2-digit',hour12: state.format12h});
            if(zenDate) zenDate.textContent = now.toLocaleDateString('en-US', {weekday:'long',month:'long',day:'numeric'});
        }

        function exitZen() {
            overlay?.classList.add('hidden');
            document.body.style.overflow = '';
            if(zenInterval) { clearInterval(zenInterval); zenInterval = null; }
        }

        function initZenParticles() {
            if(!zenCanvas) return;
            const ctx = zenCanvas.getContext('2d');
            zenCanvas.width = window.innerWidth;
            zenCanvas.height = window.innerHeight;
            const stars = [];
            for(let i=0;i<100;i++) {
                stars.push({x:Math.random()*zenCanvas.width, y:Math.random()*zenCanvas.height, r:Math.random()*1.5+0.3, speed:Math.random()*0.3+0.05, twinkle:Math.random()*Math.PI*2});
            }
            function drawStars() {
                if(overlay?.classList.contains('hidden')) return;
                ctx.clearRect(0,0,zenCanvas.width,zenCanvas.height);
                stars.forEach(s => {
                    s.twinkle += 0.02;
                    const alpha = 0.3 + Math.sin(s.twinkle)*0.3;
                    ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
                    ctx.fillStyle = `rgba(200,200,255,${alpha})`; ctx.fill();
                    s.y -= s.speed;
                    if(s.y < -5) { s.y = zenCanvas.height + 5; s.x = Math.random()*zenCanvas.width; }
                });
                requestAnimationFrame(drawStars);
            }
            drawStars();
        }

        fab?.addEventListener('click', startZen);
        exitBtn?.addEventListener('click', exitZen);
        document.addEventListener('keydown', (e) => {
            if(e.key === 'Escape' && !overlay?.classList.contains('hidden')) exitZen();
        });
    }

    // Hook XP into existing Pomodoro completion
    const origUpdateStats = updateStats;
    updateStats = function(key) {
        origUpdateStats(key);
        if(key==='pomos') awardXP(20);
        else if(key==='alarms') awardXP(5);
    };

    // === INIT EXTRA FEATURES ===
    initParticles();
    initGreeting();
    initAmbient();
    initKeyboard();
    initMobileNav();
    initNotifications();
    initQuotes();
    initBreathing();
    initTimeCapsule();
    initZenMode();
    renderXP();
});
