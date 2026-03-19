document.addEventListener('DOMContentLoaded', () => {
    // === STATE & INIT ===
    let state = {
        theme: localStorage.getItem('clock_theme') || 'dark',
        format12h: localStorage.getItem('clock_format') === '12',
        alarms: JSON.parse(localStorage.getItem('clock_alarms') || '[]'),
        tasks: JSON.parse(localStorage.getItem('clock_tasks') || '{}'),
        stats: JSON.parse(localStorage.getItem('clock_stats') || '{"alarms":0, "snoozes":0, "pomos":0}'),
        cities: JSON.parse(localStorage.getItem('clock_cities') || '["America/New_York", "Europe/London"]')
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
        state.stats[key]++;
        localStorage.setItem('clock_stats', JSON.stringify(state.stats));
        renderStats();
    }

    function renderStats() {
        document.getElementById('stat-alarms').textContent = state.stats.alarms;
        document.getElementById('stat-snoozes').textContent = state.stats.snoozes;
        document.getElementById('stat-pomos').textContent = state.stats.pomos;
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

        renderStats();

        // Voice Command setup
        const voiceBtn = document.getElementById('toggle-voice');
        const voiceStatus = document.getElementById('voice-status');

        if ('webkitSpeechRecognition' in window) {
            const recognition = new webkitSpeechRecognition();
            recognition.continuous = false;
            recognition.lang = 'en-US';

            voiceBtn.addEventListener('click', () => {
                recognition.start();
                voiceStatus.textContent = 'Listening...';
                voiceStatus.style.color = 'var(--primary)';
            });

            recognition.onresult = (e) => {
                const txt = e.results[0][0].transcript.toLowerCase();
                voiceStatus.textContent = `Heard: "${txt}"`;
                voiceStatus.style.color = 'inherit';

                if (txt.includes('stop alarm') || txt.includes('dismiss alarm')) {
                    if (activeAlarm) { dismissAlarm(); alert('Alarm dismissed by voice.'); }
                } else if (txt.includes('snooze')) {
                    if (activeAlarm) { snoozeAlarm(5); alert('Alarm snoozed by voice.'); }
                } else {
                    alert(`Voice command received: ${txt}\n(Try 'stop alarm' or 'snooze')`);
                }
            };

            recognition.onerror = () => {
                voiceStatus.textContent = 'Error listening. Try again.';
            };
        } else {
            voiceBtn.disabled = true;
            voiceStatus.textContent = 'Speech recognition not supported in this browser.';
        }
    }

    // === GESTURE CONTROL (Shake to dismiss) ===
    function initGestures() {
        if (typeof DeviceMotionEvent !== 'undefined') {
            let lastUpdate = 0;
            let lastX = null, lastY = null, lastZ = null;
            const threshold = 15;

            window.addEventListener('devicemotion', (e) => {
                if (!activeAlarm) return;

                const curTime = Date.now();
                if ((curTime - lastUpdate) > 100) {
                    const diffTime = (curTime - lastUpdate);
                    lastUpdate = curTime;

                    const acc = e.accelerationIncludingGravity;
                    if (!acc) return;

                    if (lastX !== null) {
                        const speed = Math.abs(acc.x + acc.y + acc.z - lastX - lastY - lastZ) / diffTime * 10000;
                        if (speed > threshold) {
                            snoozeAlarm(5);
                            alert('Device shaken! Alarm snoozed for 5 minutes.');
                        }
                    }
                    lastX = acc.x; lastY = acc.y; lastZ = acc.z;
                }
            });
        }
    }
});
