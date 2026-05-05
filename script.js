// ============================================================
// CHIPML STUDIO - SCRIPT PRINCIPAL
// ============================================================

// ---------- CONFIGURACIÓN GLOBAL ----------
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null; // Se inicializa en el primer play
let chipEngine = null;
let scheduler = null;
let currentSong = null;
let playbackStartTime = 0;
let playbackPaused = false;
let currentLoop = 0;
let totalLoops = 0;
let editor = null; // Instancia de CodeMirror

// ---------- ELEMENTOS DEL DOM ----------
const btnPlay = document.getElementById('btn-play');
const btnStop = document.getElementById('btn-stop');
const btnExportMP3 = document.getElementById('btn-export-mp3');
const btnExportWAV = document.getElementById('btn-export-wav');
const btnLoad = document.getElementById('btn-load');
const btnSave = document.getElementById('btn-save');
const btnLoadExample = document.getElementById('btn-load-example');
const btnUpdateTxt = document.getElementById('btn-update-txt');
const fileInput = document.getElementById('file-input');
const editorStatus = document.getElementById('editor-status');
const playbackIndicator = document.getElementById('playback-indicator');
const globalStatus = document.getElementById('global-status');
const timeDisplay = document.getElementById('time-display');
const chipDisplay = document.getElementById('chip-display');
const loadingOverlay = document.getElementById('loading-overlay');
const helpPanel = document.getElementById('help-panel');
const editorWrapper = document.getElementById('editor-wrapper');
const tabs = document.querySelectorAll('.tab');

// Sliders y valores
const sliders = {
    volA: document.getElementById('vol-A'),
    volB: document.getElementById('vol-B'),
    volC: document.getElementById('vol-C'),
    volN: document.getElementById('vol-N'),
    tempo: document.getElementById('tempo-slider'),
    master: document.getElementById('master-vol'),
    transpose: document.getElementById('transpose-slider'),
    loop: document.getElementById('loop-input'),
    chip: document.getElementById('chip-select')
};

const sliderValues = {
    volA: document.querySelector('#vol-A + .vol-value'),
    volB: document.querySelector('#vol-B + .vol-value'),
    volC: document.querySelector('#vol-C + .vol-value'),
    volN: document.querySelector('#vol-N + .vol-value'),
    tempo: document.getElementById('tempo-value'),
    master: document.getElementById('master-vol-value'),
    transpose: document.getElementById('transpose-value')
};

// ---------- INICIALIZACIÓN DEL EDITOR CODEMIRROR ----------
document.addEventListener('DOMContentLoaded', () => {
    // Configurar CodeMirror
    editor = CodeMirror.fromTextArea(document.getElementById('chipml-editor'), {
        mode: 'javascript', // Modo básico; se puede extender
        theme: 'monokai',
        lineNumbers: true,
        lineWrapping: false,
        tabSize: 2,
        indentUnit: 2,
        viewportMargin: Infinity,
        styleActiveLine: true
    });

    // Cargar ejemplo por defecto
    loadExample();

    // Configurar pestañas
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            if (tab.dataset.tab === 'help') {
                editorWrapper.style.display = 'none';
                helpPanel.style.display = 'block';
            } else {
                editorWrapper.style.display = 'block';
                helpPanel.style.display = 'none';
                editor.refresh();
            }
        });
    });

    // Eventos de botones
    btnPlay.addEventListener('click', togglePlay);
    btnStop.addEventListener('click', stopPlayback);
    btnExportMP3.addEventListener('click', () => exportAudio('mp3'));
    btnExportWAV.addEventListener('click', () => exportAudio('wav'));
    btnLoad.addEventListener('click', () => fileInput.click());
    btnSave.addEventListener('click', saveFile);
    btnLoadExample.addEventListener('click', loadExample);
    btnUpdateTxt.addEventListener('click', updateTextFromSliders);
    fileInput.addEventListener('change', loadFile);

    // Eventos de sliders para actualizar valores mostrados y motor en tiempo real
    Object.keys(sliders).forEach(key => {
        if (sliders[key]) {
            sliders[key].addEventListener('input', () => {
                updateSliderLabel(key);
                if (chipEngine && currentSong) {
                    applySliderToEngine(key);
                }
            });
        }
    });

    // Inicializar etiquetas
    Object.keys(sliderValues).forEach(key => updateSliderLabel(key));

    // Evento de cambio de chip
    sliders.chip.addEventListener('change', () => {
        if (chipEngine && currentSong) {
            // Reiniciar canales en el mezclador (no implementado en profundidad)
            updateChannelSliders(sliders.chip.value);
        }
    });
});

// ---------- FUNCIONES DE UI ----------
function updateSliderLabel(key) {
    const slider = sliders[key];
    const label = sliderValues[key];
    if (!slider || !label) return;
    label.textContent = slider.value;
}

function updateChannelSliders(chip) {
    // Simplemente ocultar/mostrar sliders según chip (se podría mejorar)
    const container = document.getElementById('channel-sliders');
    let html = '';
    if (chip === 'nes') {
        html = `<h3>Canales NES</h3>
            <div class="slider-row"><label for="vol-A">Pulso A</label><input type="range" id="vol-A" min="0" max="15" value="${sliders.volA.value}" step="1"><span class="vol-value">${sliders.volA.value}</span><canvas class="vu-meter" id="vu-A" width="40" height="8"></canvas></div>
            <div class="slider-row"><label for="vol-B">Pulso B</label><input type="range" id="vol-B" min="0" max="15" value="${sliders.volB.value}" step="1"><span class="vol-value">${sliders.volB.value}</span><canvas class="vu-meter" id="vu-B" width="40" height="8"></canvas></div>
            <div class="slider-row"><label for="vol-C">Triángulo</label><input type="range" id="vol-C" min="0" max="15" value="${sliders.volC.value}" step="1"><span class="vol-value">${sliders.volC.value}</span><canvas class="vu-meter" id="vu-C" width="40" height="8"></canvas></div>
            <div class="slider-row"><label for="vol-N">Ruido</label><input type="range" id="vol-N" min="0" max="15" value="${sliders.volN.value}" step="1"><span class="vol-value">${sliders.volN.value}</span><canvas class="vu-meter" id="vu-N" width="40" height="8"></canvas></div>`;
    } else if (chip === 'gb') {
        html = `<h3>Canales Game Boy</h3>
            <div class="slider-row"><label for="vol-A">Pulso 1</label><input type="range" id="vol-A" min="0" max="15" value="${sliders.volA.value}" step="1"><span class="vol-value">${sliders.volA.value}</span><canvas class="vu-meter" id="vu-A" width="40" height="8"></canvas></div>
            <div class="slider-row"><label for="vol-B">Pulso 2</label><input type="range" id="vol-B" min="0" max="15" value="${sliders.volB.value}" step="1"><span class="vol-value">${sliders.volB.value}</span><canvas class="vu-meter" id="vu-B" width="40" height="8"></canvas></div>
            <div class="slider-row"><label for="vol-W">Wavetable</label><input type="range" id="vol-W" min="0" max="15" value="10" step="1"><span class="vol-value">10</span></div>
            <div class="slider-row"><label for="vol-N">Ruido</label><input type="range" id="vol-N" min="0" max="15" value="${sliders.volN.value}" step="1"><span class="vol-value">${sliders.volN.value}</span><canvas class="vu-meter" id="vu-N" width="40" height="8"></canvas></div>`;
    } // Otros chips simplificados...
    container.innerHTML = html;
    // Reasignar referencias
    ['volA','volB','volC','volN'].forEach(id => {
        const el = document.getElementById(`vol-${id.slice(-1)}`);
        if (el) sliders[id] = el;
    });
}

function applySliderToEngine(key) {
    const value = parseInt(sliders[key].value);
    switch(key) {
        case 'tempo':
            // Cambiar tempo en caliente (requiere reschedule)
            break;
        case 'master':
            if (chipEngine.masterGain) {
                chipEngine.masterGain.gain.value = value / 15;
            }
            break;
        case 'volA': chipEngine.setChannelVolume('A', value / 15); break;
        case 'volB': chipEngine.setChannelVolume('B', value / 15); break;
        case 'volC': chipEngine.setChannelVolume('C', value / 15); break;
        case 'volN': chipEngine.setChannelVolume('N', value / 15); break;
    }
}

// ---------- CARGA Y GUARDADO DE ARCHIVOS ----------
function loadExample() {
    const example = `#chip nes
#tempo 140
#loop 2
#master_volume 12

!1 wave=pulse,duty=50
!2 wave=pulse,duty=25
!3 wave=triangle
!4 wave=noise,mode=short

A: t140 o4 l8 v11 @1 [c e g >c<]2 f+ a >c+< a r4
B: t140 o3 l8 v9 @2 e g >c< e c <b- a r4
C: t140 o2 l4 v13 @3 c8 g8 >c8 c8 <f8 c8 g8 g8
N: t140 l16 v14 @4 [n8 n16 n8 n16]4`;
    editor.setValue(example);
    globalStatus.textContent = '🟢 Ejemplo NES cargado';
    chipDisplay.textContent = 'Chip: NES';
    sliders.chip.value = 'nes';
    updateChannelSliders('nes');
}

function saveFile() {
    const text = editor.getValue();
    const blob = new Blob([text], {type: 'text/plain'});
    saveAs(blob, 'mi_cancion.chipml');
    globalStatus.textContent = '💾 Archivo guardado';
}

function loadFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        editor.setValue(ev.target.result);
        globalStatus.textContent = '📂 Archivo cargado';
        // Intentar extraer chip
        const firstLines = ev.target.result.split('\n').slice(0,5).join('\n');
        const chipMatch = firstLines.match(/#chip\s+(\w+)/);
        if (chipMatch) {
            sliders.chip.value = chipMatch[1];
            updateChannelSliders(chipMatch[1]);
            chipDisplay.textContent = `Chip: ${chipMatch[1].toUpperCase()}`;
        }
    };
    reader.readAsText(file);
}

// ---------- ACTUALIZAR TXT DESDE SLIDERS ----------
function updateTextFromSliders() {
    let text = editor.getValue();
    const lines = text.split('\n');
    // Actualizar o agregar directivas
    const newDirectives = {
        '#tempo': sliders.tempo.value,
        '#master_volume': sliders.master.value,
        '#loop': sliders.loop.value,
        '#transpose': sliders.transpose.value,
        '#chip': sliders.chip.value
    };
    
    // Reemplazar o insertar directivas en las primeras líneas
    for (const [key, val] of Object.entries(newDirectives)) {
        const regex = new RegExp(`^${key}\\s+.*$`, 'm');
        if (regex.test(text)) {
            text = text.replace(regex, `${key} ${val}`);
        } else {
            // Insertar después de #chip si existe
            const chipIdx = text.indexOf('#chip');
            if (chipIdx !== -1) {
                const endOfLine = text.indexOf('\n', chipIdx);
                text = text.slice(0, endOfLine+1) + `${key} ${val}\n` + text.slice(endOfLine+1);
            } else {
                text = `${key} ${val}\n` + text;
            }
        }
    }

    // Ajustar volúmenes en los canales (buscar inicio de cada canal)
    const channelVols = {
        'A': sliders.volA.value,
        'B': sliders.volB.value,
        'C': sliders.volC.value,
        'N': sliders.volN.value
    };
    for (const [ch, vol] of Object.entries(channelVols)) {
        const chRegex = new RegExp(`^${ch}:`, 'm');
        const match = text.match(chRegex);
        if (match) {
            const lineStart = text.lastIndexOf('\n', match.index) + 1;
            const lineEnd = text.indexOf('\n', match.index);
            let line = text.substring(lineStart, lineEnd);
            // Reemplazar o añadir v...
            if (/v\d+/.test(line)) {
                line = line.replace(/v\d+/, `v${vol}`);
            } else {
                // Insertar v después del primer comando de nota o tempo
                line = line.replace(/^(\w+:\s*)/, `$1v${vol} `);
            }
            text = text.substring(0, lineStart) + line + text.substring(lineEnd);
        }
    }

    editor.setValue(text);
    globalStatus.textContent = '♻ TXT actualizado con ajustes';
}

// ============================================================
// PARSER CHIPML
// ============================================================
function parseChipML(text) {
    const song = {
        directives: { chip: 'nes', tempo: 120, loop: 1, master_volume: 12, transpose: 0 },
        instruments: {},
        channels: {},
        macros: {},
        totalDuration: 0
    };

    const lines = text.split('\n');
    let lineNumber = 0;
    let currentMacro = null;

    // Primera pasada: recolectar directivas, instrumentos y macros
    const channelLines = [];
    for (const rawLine of lines) {
        lineNumber++;
        let line = rawLine.trim();
        // Eliminar comentarios
        const commentIdx = line.indexOf('#');
        if (commentIdx !== -1) line = line.substring(0, commentIdx).trim();
        if (line === '') continue;

        // Directiva #
        if (line.startsWith('#')) {
            const parts = line.slice(1).split(/\s+/);
            const key = '#' + parts[0].toLowerCase();
            const value = parts.slice(1).join(' ');
            switch (key) {
                case '#chip': song.directives.chip = value; break;
                case '#tempo': song.directives.tempo = parseInt(value) || 120; break;
                case '#loop': song.directives.loop = parseInt(value) || 1; break;
                case '#master_volume': song.directives.master_volume = parseInt(value) || 12; break;
                case '#transpose': song.directives.transpose = parseInt(value) || 0; break;
                // Otros filtros etc.
            }
            continue;
        }

        // Instrumento !
        if (line.startsWith('!')) {
            const instMatch = line.match(/^!(\d+)\s+(.*)/);
            if (instMatch) {
                const id = instMatch[1];
                const params = {};
                instMatch[2].split(',').forEach(p => {
                    const [k, v] = p.split('=');
                    if (k && v) params[k.trim()] = v.trim();
                });
                song.instruments[id] = params;
            }
            continue;
        }

        // Macro $
        if (line.startsWith('$') && line.includes('{')) {
            const macroMatch = line.match(/^(\$\w+)\s*\{/);
            if (macroMatch) {
                currentMacro = macroMatch[1];
                song.macros[currentMacro] = '';
                const rest = line.substring(line.indexOf('{')+1);
                if (rest.includes('}')) {
                    song.macros[currentMacro] = rest.split('}')[0].trim();
                    currentMacro = null;
                } else if (rest.trim()) {
                    song.macros[currentMacro] += rest.trim();
                }
            }
            continue;
        }
        if (currentMacro) {
            if (line.includes('}')) {
                song.macros[currentMacro] += ' ' + line.split('}')[0].trim();
                currentMacro = null;
            } else {
                song.macros[currentMacro] += ' ' + line;
            }
            continue;
        }

        // Canal
        if (/^[A-Za-z0-9]+:/.test(line)) {
            channelLines.push(line);
        }
    }

    // Expandir macros en los canales
    const expandedChannels = {};
    for (const chLine of channelLines) {
        const colonIdx = chLine.indexOf(':');
        const chName = chLine.substring(0, colonIdx).trim();
        let chContent = chLine.substring(colonIdx+1).trim();
        // Expandir macros recursivamente (simple)
        for (const [macro, def] of Object.entries(song.macros)) {
            chContent = chContent.replace(new RegExp('\\'+macro, 'g'), def);
        }
        if (!expandedChannels[chName]) expandedChannels[chName] = '';
        expandedChannels[chName] += (expandedChannels[chName] ? ' ' : '') + chContent;
    }

    // Segunda pasada: parsear cada canal en eventos
    const tempo = song.directives.tempo;
    const transpose = song.directives.transpose;
    let maxTime = 0;

    for (const [chName, content] of Object.entries(expandedChannels)) {
        const events = parseChannel(content, tempo, transpose);
        song.channels[chName] = events;
        if (events.length > 0) {
            const lastEvent = events[events.length-1];
            const eventEnd = lastEvent.time + lastEvent.duration;
            if (eventEnd > maxTime) maxTime = eventEnd;
        }
    }

    song.totalDuration = maxTime * (song.directives.loop === 0 ? 9999 : song.directives.loop);
    return song;
}

function parseChannel(content, tempo, transpose) {
    const tokens = tokenize(content);
    const events = [];
    let currentTime = 0;
    let currentOctave = 4;
    let currentLength = 4; // negra por defecto
    let currentVolume = 10;
    let currentInstrument = 1;
    let currentTempo = tempo;
    let currentTranspose = transpose;
    let noteLength = 60 / currentTempo * (4 / currentLength); // segundos por figura
    let tie = false;

    const noteMap = { c:0, d:2, e:4, f:5, g:7, a:9, b:11 };

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        // Notas
        if (/^[a-g][+\-]?$/.test(token)) {
            const note = token[0];
            const accidental = token[1] || '';
            let semitone = noteMap[note] + (accidental === '+' ? 1 : accidental === '-' ? -1 : 0);
            let midi = (currentOctave + 1) * 12 + semitone + currentTranspose;
            let duration = noteLength;
            // Puntillo
            if (i+1 < tokens.length && tokens[i+1] === '.') {
                duration *= 1.5;
                i++;
            }
            // Duración explícita (número)
            if (i+1 < tokens.length && /^\d+$/.test(tokens[i+1])) {
                const explicitLen = parseInt(tokens[i+1]);
                duration = 60 / currentTempo * (4 / explicitLen);
                i++;
            }
            // Ligadura
            if (i+1 < tokens.length && tokens[i+1] === '&') {
                tie = true;
                i++;
            }

            events.push({
                time: currentTime,
                type: 'note_on',
                note: midi,
                duration: duration,
                instrument: currentInstrument,
                volume: currentVolume / 15
            });

            if (!tie) {
                currentTime += duration;
            }
            tie = false;
            continue;
        }

        // Silencio r
        if (token === 'r') {
            let duration = noteLength;
            if (i+1 < tokens.length && /^\d+$/.test(tokens[i+1])) {
                duration = 60 / currentTempo * (4 / parseInt(tokens[i+1]));
                i++;
            }
            currentTime += duration;
            continue;
        }

        // Comandos
        switch (token) {
            case 'o': currentOctave = parseInt(tokens[++i]); break;
            case '>': currentOctave++; break;
            case '<': currentOctave--; break;
            case 'l': 
                currentLength = parseInt(tokens[++i]);
                noteLength = 60 / currentTempo * (4 / currentLength);
                break;
            case 'v': currentVolume = parseInt(tokens[++i]); break;
            case '@': currentInstrument = parseInt(tokens[++i]); break;
            case 't':
                currentTempo = parseInt(tokens[++i]);
                noteLength = 60 / currentTempo * (4 / currentLength);
                break;
            case 'k': currentTranspose = parseInt(tokens[++i]); break;
            // Efectos y repeticiones simplificados (no implementados a fondo)
        
