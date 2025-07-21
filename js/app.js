'use strict';

/**
 * 音声ファイル分割ツール
 * Web Audio APIを使用した音声ファイル分割アプリケーション
 */

// グローバル変数
let audioContext = null;
let audioBuffer = null;
let currentFile = null;
let sourceNode = null;
let isPlaying = false;
let startTime = 0;
let pauseTime = 0;

// DOM要素の取得
const elements = {
  uploadBox: document.getElementById('uploadBox'),
  fileInput: document.getElementById('fileInput'),
  browseBtn: document.querySelector('.btn-browse'),
  
  fileInfo: document.getElementById('file-info'),
  fileName: document.getElementById('fileName'),
  fileDuration: document.getElementById('fileDuration'),
  fileSize: document.getElementById('fileSize'),
  
  waveformSection: document.getElementById('waveform-section'),
  waveformCanvas: document.getElementById('waveformCanvas'),
  playBtn: document.getElementById('playBtn'),
  currentTime: document.getElementById('currentTime'),
  
  splitSettings: document.getElementById('split-settings'),
  splitModeRadios: document.querySelectorAll('input[name="splitMode"]'),
  timeSettings: document.getElementById('timeSettings'),
  partsSettings: document.getElementById('partsSettings'),
  splitMinutes: document.getElementById('splitMinutes'),
  splitParts: document.getElementById('splitParts'),
  filePrefix: document.getElementById('filePrefix'),
  splitBtn: document.getElementById('splitBtn'),
  
  progressSection: document.getElementById('progress-section'),
  progressFill: document.getElementById('progressFill'),
  progressText: document.getElementById('progressText'),
  
  resultsSection: document.getElementById('results-section'),
  resultsList: document.getElementById('resultsList'),
  downloadAllBtn: document.getElementById('downloadAllBtn'),
  resetBtn: document.getElementById('resetBtn')
};

// 初期化
window.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkBrowserSupport();
});

/**
 * ブラウザのWeb Audio APIサポートをチェック
 */
function checkBrowserSupport() {
  if (!window.AudioContext && !window.webkitAudioContext) {
    alert('お使いのブラウザはWeb Audio APIに対応していません。最新のChrome、Firefox、Safariをお使いください。');
    return false;
  }
  return true;
}

/**
 * イベントリスナーの設定
 */
function setupEventListeners() {
  // ファイル選択
  elements.browseBtn.addEventListener('click', () => {
    elements.fileInput.click();
  });
  
  elements.fileInput.addEventListener('change', handleFileSelect);
  
  // ドラッグ&ドロップ
  elements.uploadBox.addEventListener('dragover', handleDragOver);
  elements.uploadBox.addEventListener('dragleave', handleDragLeave);
  elements.uploadBox.addEventListener('drop', handleDrop);
  elements.uploadBox.addEventListener('click', (e) => {
    if (e.target === elements.uploadBox) {
      elements.fileInput.click();
    }
  });
  
  // 再生コントロール
  elements.playBtn.addEventListener('click', togglePlayback);
  
  // 分割モード切り替え
  elements.splitModeRadios.forEach(radio => {
    radio.addEventListener('change', handleSplitModeChange);
  });
  
  // 分割実行
  elements.splitBtn.addEventListener('click', handleSplit);
  
  // ダウンロード
  elements.downloadAllBtn.addEventListener('click', handleDownloadAll);
  
  // リセット
  elements.resetBtn.addEventListener('click', handleReset);
}

/**
 * ファイル選択処理
 */
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) {
    processFile(file);
  }
}

/**
 * ドラッグオーバー処理
 */
function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  elements.uploadBox.classList.add('drag-over');
}

/**
 * ドラッグリーブ処理
 */
function handleDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  elements.uploadBox.classList.remove('drag-over');
}

/**
 * ドロップ処理
 */
function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  elements.uploadBox.classList.remove('drag-over');
  
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    processFile(files[0]);
  }
}

/**
 * ファイル処理
 */
async function processFile(file) {
  // ファイルタイプチェック
  if (!file.type.startsWith('audio/')) {
    alert('音声ファイルを選択してください。');
    return;
  }
  
  currentFile = file;
  
  // ファイル情報表示
  displayFileInfo(file);
  
  // 音声データの読み込み
  try {
    showSection('loading');
    const arrayBuffer = await readFileAsArrayBuffer(file);
    await decodeAudioData(arrayBuffer);
    
    // 波形描画
    drawWaveform();
    
    // UI表示
    showSection('ready');
    
  } catch (error) {
    console.error('ファイル処理エラー:', error);
    alert('ファイルの読み込みに失敗しました。');
    handleReset();
  }
}

/**
 * ファイルをArrayBufferとして読み込み
 */
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 音声データのデコード
 */
async function decodeAudioData(arrayBuffer) {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  
  audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
}

/**
 * ファイル情報の表示
 */
function displayFileInfo(file) {
  elements.fileName.textContent = file.name;
  elements.fileSize.textContent = formatFileSize(file.size);
  
  if (audioBuffer) {
    const duration = audioBuffer.duration;
    elements.fileDuration.textContent = formatTime(duration);
  }
}

/**
 * 波形の描画
 */
function drawWaveform() {
  const canvas = elements.waveformCanvas;
  const ctx = canvas.getContext('2d');
  
  // キャンバスサイズ設定
  canvas.width = canvas.offsetWidth * window.devicePixelRatio;
  canvas.height = canvas.offsetHeight * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  
  const width = canvas.offsetWidth;
  const height = canvas.offsetHeight;
  
  // 背景クリア
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  
  // 波形データ取得（簡略化のため左チャンネルのみ）
  const data = audioBuffer.getChannelData(0);
  const step = Math.ceil(data.length / width);
  const amp = height / 2;
  
  // 波形描画
  ctx.beginPath();
  ctx.moveTo(0, amp);
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 1;
  
  for (let i = 0; i < width; i++) {
    let min = 1.0;
    let max = -1.0;
    
    for (let j = 0; j < step; j++) {
      const datum = data[(i * step) + j];
      if (datum < min) min = datum;
      if (datum > max) max = datum;
    }
    
    ctx.lineTo(i, (1 + min) * amp);
    ctx.lineTo(i, (1 + max) * amp);
  }
  
  ctx.stroke();
  
  // 時間表示更新
  updateTimeDisplay();
}

/**
 * 再生/一時停止の切り替え
 */
function togglePlayback() {
  if (isPlaying) {
    pausePlayback();
  } else {
    startPlayback();
  }
}

/**
 * 再生開始
 */
function startPlayback() {
  if (!audioBuffer) return;
  
  sourceNode = audioContext.createBufferSource();
  sourceNode.buffer = audioBuffer;
  sourceNode.connect(audioContext.destination);
  
  if (pauseTime > 0) {
    startTime = audioContext.currentTime - pauseTime;
    sourceNode.start(0, pauseTime);
  } else {
    startTime = audioContext.currentTime;
    sourceNode.start(0);
  }
  
  isPlaying = true;
  elements.playBtn.textContent = '一時停止';
  
  sourceNode.onended = () => {
    if (isPlaying) {
      stopPlayback();
    }
  };
  
  updateTimeDisplay();
}

/**
 * 再生一時停止
 */
function pausePlayback() {
  if (!sourceNode) return;
  
  pauseTime = audioContext.currentTime - startTime;
  sourceNode.stop();
  sourceNode = null;
  
  isPlaying = false;
  elements.playBtn.textContent = '再生';
}

/**
 * 再生停止
 */
function stopPlayback() {
  pauseTime = 0;
  startTime = 0;
  isPlaying = false;
  elements.playBtn.textContent = '再生';
  updateTimeDisplay();
}

/**
 * 時間表示更新
 */
function updateTimeDisplay() {
  if (!audioBuffer) return;
  
  let currentTime = 0;
  if (isPlaying) {
    currentTime = audioContext.currentTime - startTime;
  } else {
    currentTime = pauseTime;
  }
  
  const duration = audioBuffer.duration;
  elements.currentTime.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
  
  if (isPlaying) {
    requestAnimationFrame(updateTimeDisplay);
  }
}

/**
 * 分割モード変更処理
 */
function handleSplitModeChange(e) {
  const mode = e.target.value;
  if (mode === 'time') {
    elements.timeSettings.style.display = 'block';
    elements.partsSettings.style.display = 'none';
  } else {
    elements.timeSettings.style.display = 'none';
    elements.partsSettings.style.display = 'block';
  }
}

/**
 * 分割処理
 */
async function handleSplit() {
  if (!audioBuffer) return;
  
  // 再生中の場合は停止
  if (isPlaying) {
    pausePlayback();
  }
  
  showSection('processing');
  
  try {
    const mode = document.querySelector('input[name="splitMode"]:checked').value;
    const segments = calculateSegments(mode);
    
    await processSegments(segments);
    
    showSection('results');
    
  } catch (error) {
    console.error('分割処理エラー:', error);
    alert('分割処理中にエラーが発生しました。');
    showSection('ready');
  }
}

/**
 * セグメント計算
 */
function calculateSegments(mode) {
  const duration = audioBuffer.duration;
  const segments = [];
  
  if (mode === 'time') {
    const minutes = parseFloat(elements.splitMinutes.value);
    const seconds = minutes * 60;
    let start = 0;
    let partNumber = 1;
    
    while (start < duration) {
      const end = Math.min(start + seconds, duration);
      segments.push({
        start,
        end,
        name: generateFileName(partNumber)
      });
      start = end;
      partNumber++;
    }
  } else {
    const parts = parseInt(elements.splitParts.value);
    const partDuration = duration / parts;
    
    for (let i = 0; i < parts; i++) {
      segments.push({
        start: i * partDuration,
        end: Math.min((i + 1) * partDuration, duration),
        name: generateFileName(i + 1)
      });
    }
  }
  
  return segments;
}

/**
 * ファイル名生成
 */
function generateFileName(partNumber) {
  const prefix = elements.filePrefix.value || currentFile.name.replace(/\.[^/.]+$/, '');
  return `${prefix}_part${partNumber.toString().padStart(2, '0')}.wav`;
}

/**
 * セグメント処理
 */
async function processSegments(segments) {
  const results = [];
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    updateProgress(i, segments.length, segment.name);
    
    const segmentBuffer = extractSegment(segment.start, segment.end);
    const blob = await encodeAudioBuffer(segmentBuffer);
    
    results.push({
      name: segment.name,
      blob,
      duration: segment.end - segment.start,
      url: URL.createObjectURL(blob)
    });
  }
  
  displayResults(results);
}

/**
 * セグメント抽出
 */
function extractSegment(start, end) {
  const sampleRate = audioBuffer.sampleRate;
  const startSample = Math.floor(start * sampleRate);
  const endSample = Math.floor(end * sampleRate);
  const length = endSample - startSample;
  
  const segmentBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    length,
    sampleRate
  );
  
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const sourceData = audioBuffer.getChannelData(channel);
    const targetData = segmentBuffer.getChannelData(channel);
    
    for (let i = 0; i < length; i++) {
      targetData[i] = sourceData[startSample + i];
    }
  }
  
  return segmentBuffer;
}

/**
 * 音声バッファをWAVファイルにエンコード
 */
async function encodeAudioBuffer(buffer) {
  const length = buffer.length * buffer.numberOfChannels * 2 + 44;
  const arrayBuffer = new ArrayBuffer(length);
  const view = new DataView(arrayBuffer);
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  
  // WAVヘッダー書き込み
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, length - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length - 44, true);
  
  // 音声データ書き込み
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < channels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * 進捗更新
 */
function updateProgress(current, total, fileName) {
  const progress = ((current + 1) / total) * 100;
  elements.progressFill.style.width = `${progress}%`;
  elements.progressText.textContent = `処理中: ${fileName} (${current + 1}/${total})`;
}

/**
 * 結果表示
 */
function displayResults(results) {
  elements.resultsList.innerHTML = '';
  
  results.forEach((result, index) => {
    const item = document.createElement('div');
    item.className = 'result-item fade-in';
    item.innerHTML = `
      <div class="result-info">
        <div class="result-name">${result.name}</div>
        <div class="result-duration">${formatTime(result.duration)}</div>
      </div>
      <div class="result-actions">
        <button class="btn btn-secondary" onclick="playPreview('${result.url}')">試聴</button>
        <a href="${result.url}" download="${result.name}" class="btn btn-primary">ダウンロード</a>
      </div>
    `;
    
    elements.resultsList.appendChild(item);
  });
  
  // 結果を保持
  window.splitResults = results;
}

/**
 * プレビュー再生
 */
window.playPreview = function(url) {
  const audio = new Audio(url);
  audio.play();
};

/**
 * 全ファイルダウンロード
 */
async function handleDownloadAll() {
  if (!window.splitResults) return;
  
  // ZIP作成は将来的に実装
  // 現時点では個別ダウンロードリンクをクリック
  const links = elements.resultsList.querySelectorAll('a[download]');
  links.forEach((link, index) => {
    setTimeout(() => link.click(), index * 100);
  });
}

/**
 * リセット処理
 */
function handleReset() {
  // 再生停止
  if (isPlaying) {
    pausePlayback();
  }
  
  // 変数リセット
  audioBuffer = null;
  currentFile = null;
  
  // UI初期化
  showSection('upload');
  elements.fileInput.value = '';
  
  // 結果クリーンアップ
  if (window.splitResults) {
    window.splitResults.forEach(result => {
      URL.revokeObjectURL(result.url);
    });
    window.splitResults = null;
  }
}

/**
 * セクション表示切り替え
 */
function showSection(state) {
  const sections = {
    upload: [elements.fileInfo, elements.waveformSection, elements.splitSettings, elements.progressSection, elements.resultsSection],
    loading: [elements.waveformSection, elements.splitSettings, elements.progressSection, elements.resultsSection],
    ready: [elements.progressSection, elements.resultsSection],
    processing: [elements.resultsSection],
    results: []
  };
  
  // すべて非表示
  Object.values(sections).flat().forEach(section => {
    if (section) section.style.display = 'none';
  });
  
  // 指定されたセクション以外を表示
  sections[state].forEach(section => {
    if (section) section.style.display = 'none';
  });
  
  // 必要なセクションを表示
  switch (state) {
    case 'ready':
      elements.fileInfo.style.display = 'block';
      elements.waveformSection.style.display = 'block';
      elements.splitSettings.style.display = 'block';
      break;
    case 'processing':
      elements.progressSection.style.display = 'block';
      break;
    case 'results':
      elements.resultsSection.style.display = 'block';
      break;
  }
}

/**
 * ファイルサイズフォーマット
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 時間フォーマット
 */
function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}