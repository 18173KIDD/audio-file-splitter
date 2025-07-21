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
let waveformEnhanced = null; // 拡張波形表示インスタンス

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
  markersSettings: document.getElementById('markersSettings'),
  markersList: document.getElementById('markersList'),
  splitMinutes: document.getElementById('splitMinutes'),
  splitParts: document.getElementById('splitParts'),
  filePrefix: document.getElementById('filePrefix'),
  namingPattern: document.getElementById('namingPattern'),
  customPatternDiv: document.getElementById('customPattern'),
  customPatternInput: document.getElementById('customPatternInput'),
  splitBtn: document.getElementById('splitBtn'),
  
  progressSection: document.getElementById('progress-section'),
  progressFill: document.getElementById('progressFill'),
  progressText: document.getElementById('progressText'),
  
  resultsSection: document.getElementById('results-section'),
  resultsList: document.getElementById('resultsList'),
  downloadAllBtn: document.getElementById('downloadAllBtn'),
  resetBtn: document.getElementById('resetBtn'),
  
  // ズームコントロール
  zoomInBtn: document.getElementById('zoomInBtn'),
  zoomOutBtn: document.getElementById('zoomOutBtn'),
  zoomResetBtn: document.getElementById('zoomResetBtn')
};

// 初期化
window.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkBrowserSupport();
  updateUIForDevice();
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
 * デバイスに応じたUI更新
 */
function updateUIForDevice() {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const waveformHelp = document.querySelector('.waveform-help small');
  
  if (isMobile && waveformHelp) {
    waveformHelp.innerHTML = '📱 タップ: シーク | ピンチ: ズーム | スワイプ: パン | ロングタップ: 分割位置追加';
  }
  
  // モバイルでのファイルアップロード改善
  if (isMobile) {
    const fileInput = elements.fileInput;
    if (fileInput) {
      // iOSで音声ファイルの録音を許可
      fileInput.setAttribute('capture', 'microphone');
    }
  }
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
  
  // 命名パターン切り替え
  elements.namingPattern?.addEventListener('change', handleNamingPatternChange);
  
  // 分割実行
  elements.splitBtn.addEventListener('click', handleSplit);
  
  // ダウンロード
  elements.downloadAllBtn.addEventListener('click', handleDownloadAll);
  
  // リセット
  elements.resetBtn.addEventListener('click', handleReset);
  
  // ズームコントロール
  elements.zoomInBtn?.addEventListener('click', () => {
    if (waveformEnhanced) {
      waveformEnhanced.zoom *= 1.5;
      waveformEnhanced.zoom = Math.min(waveformEnhanced.zoom, 20);
      waveformEnhanced.draw();
    }
  });
  
  elements.zoomOutBtn?.addEventListener('click', () => {
    if (waveformEnhanced) {
      waveformEnhanced.zoom /= 1.5;
      waveformEnhanced.zoom = Math.max(waveformEnhanced.zoom, 1);
      waveformEnhanced.draw();
    }
  });
  
  elements.zoomResetBtn?.addEventListener('click', () => {
    if (waveformEnhanced) {
      waveformEnhanced.resetZoom();
    }
  });
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
    showError('音声ファイルを選択してください。対応形式: MP3, WAV, M4A, OGG');
    return;
  }
  
  // ファイルサイズチェック（500MB制限）
  const maxSize = 500 * 1024 * 1024;
  if (file.size > maxSize) {
    showError('ファイルサイズが大きすぎます。500MB以下のファイルを選択してください。');
    return;
  }
  
  currentFile = file;
  
  // ファイル情報表示
  displayFileInfo(file);
  
  // 音声データの読み込み
  try {
    showSection('loading');
    updateProgress(0, 1, 'ファイルを読み込み中...');
    
    const arrayBuffer = await readFileAsArrayBuffer(file);
    updateProgress(0.5, 1, 'オーディオデータをデコード中...');
    
    await decodeAudioData(arrayBuffer);
    
    // ファイル情報を再度更新（duration取得後）
    displayFileInfo(file);
    
    // 波形描画
    updateProgress(0.8, 1, '波形を生成中...');
    drawWaveform();
    
    // UI表示
    showSection('ready');
    showSuccess(`${file.name} を読み込みました`);
    
  } catch (error) {
    console.error('ファイル処理エラー:', error);
    let errorMessage = 'ファイルの読み込みに失敗しました。';
    
    // エラーメッセージの詳細化
    if (error.name === 'EncodingError' || error.message.includes('decode')) {
      errorMessage = 'このファイル形式はサポートされていません。MP3、WAV、M4A、OGGファイルをお試しください。';
    } else if (error.name === 'NotSupportedError') {
      errorMessage = 'お使いのブラウザはこのファイル形式に対応していません。';
    }
    
    showError(errorMessage);
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
  
  // Safari対策: ユーザー操作後にコンテキストを再開
  if (audioContext.state === 'suspended') {
    try {
      await audioContext.resume();
    } catch (error) {
      console.warn('AudioContext再開に失敗:', error);
    }
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
  } else {
    elements.fileDuration.textContent = '読み込み中...';
  }
}

/**
 * エラーメッセージ表示
 */
function showError(message) {
  // 既存のメッセージを削除
  const existingMsg = document.querySelector('.message-overlay');
  if (existingMsg) existingMsg.remove();
  
  const messageEl = document.createElement('div');
  messageEl.className = 'message-overlay error-message fade-in';
  messageEl.innerHTML = `
    <div class="message-content">
      <span class="message-icon">⚠️</span>
      <span class="message-text">${message}</span>
    </div>
  `;
  
  document.body.appendChild(messageEl);
  
  setTimeout(() => {
    messageEl.classList.add('fade-out');
    setTimeout(() => messageEl.remove(), 300);
  }, 5000);
}

/**
 * 成功メッセージ表示
 */
function showSuccess(message) {
  // 既存のメッセージを削除
  const existingMsg = document.querySelector('.message-overlay');
  if (existingMsg) existingMsg.remove();
  
  const messageEl = document.createElement('div');
  messageEl.className = 'message-overlay success-message fade-in';
  messageEl.innerHTML = `
    <div class="message-content">
      <span class="message-icon">✅</span>
      <span class="message-text">${message}</span>
    </div>
  `;
  
  document.body.appendChild(messageEl);
  
  setTimeout(() => {
    messageEl.classList.add('fade-out');
    setTimeout(() => messageEl.remove(), 300);
  }, 3000);
}

/**
 * 波形の描画
 */
function drawWaveform() {
  const canvas = elements.waveformCanvas;
  
  // 拡張波形モジュールを使用
  if (!waveformEnhanced) {
    waveformEnhanced = new WaveformEnhanced(canvas, audioBuffer);
    
    // シークイベントリスナー
    canvas.addEventListener('seek', (e) => {
      const time = e.detail.time;
      if (sourceNode) {
        pausePlayback();
        pauseTime = time;
        startPlayback();
      } else {
        pauseTime = time;
        updateTimeDisplay();
      }
    });
    
    // 分割マーカー変更イベントリスナー
    canvas.addEventListener('splitMarkersChanged', (e) => {
      updateSplitPreview();
    });
  } else {
    // AudioBufferが更新された場合
    waveformEnhanced.audioBuffer = audioBuffer;
    waveformEnhanced.setupCanvas();
  }
  
  waveformEnhanced.draw();
  
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
  
  // 拡張波形の再生位置更新
  if (waveformEnhanced) {
    waveformEnhanced.updatePlayhead(currentTime);
  }
  
  if (isPlaying) {
    requestAnimationFrame(updateTimeDisplay);
  }
}

/**
 * 分割プレビューの更新
 */
function updateSplitPreview() {
  if (!waveformEnhanced) return;
  
  const markers = waveformEnhanced.getSplitMarkers();
  
  // マーカーリストの更新
  elements.markersList.innerHTML = '';
  
  if (markers.length === 0) {
    elements.markersList.innerHTML = '<div style="text-align: center; color: #999;">マーカーがありません</div>';
  } else {
    markers.forEach((marker, index) => {
      const item = document.createElement('div');
      item.className = 'marker-item';
      item.innerHTML = `
        <span class="marker-time">マーカー ${index + 1}: ${formatTime(marker)}</span>
        <span class="marker-remove" onclick="removeMarker(${index})">削除</span>
      `;
      elements.markersList.appendChild(item);
    });
  }
  
  // 現在の分割モードがマーカーの場合、ボタンを有効/無効にする
  const currentMode = document.querySelector('input[name="splitMode"]:checked').value;
  if (currentMode === 'markers') {
    elements.splitBtn.disabled = markers.length === 0;
  }
}

/**
 * マーカーの削除
 */
window.removeMarker = function(index) {
  if (waveformEnhanced) {
    waveformEnhanced.removeSplitMarker(index);
  }
};

/**
 * 分割モード変更処理
 */
function handleSplitModeChange(e) {
  const mode = e.target.value;
  
  // すべての設定パネルを非表示
  elements.timeSettings.style.display = 'none';
  elements.partsSettings.style.display = 'none';
  elements.markersSettings.style.display = 'none';
  
  // 選択されたモードの設定パネルを表示
  switch (mode) {
    case 'time':
      elements.timeSettings.style.display = 'block';
      break;
    case 'parts':
      elements.partsSettings.style.display = 'block';
      break;
    case 'markers':
      elements.markersSettings.style.display = 'block';
      updateSplitPreview(); // マーカーリストを更新
      break;
  }
}

/**
 * 命名パターン変更処理
 */
function handleNamingPatternChange(e) {
  const pattern = e.target.value;
  
  // カスタムパターン入力エリアの表示/非表示
  if (elements.customPatternDiv) {
    elements.customPatternDiv.style.display = pattern === 'custom' ? 'block' : 'none';
  }
}

/**
 * 分割処理
 */
async function handleSplit() {
  if (!audioBuffer) {
    showError('まず音声ファイルを読み込んでください。');
    return;
  }
  
  // 再生中の場合は停止
  if (isPlaying) {
    pausePlayback();
  }
  
  // 入力値の検証
  const mode = document.querySelector('input[name="splitMode"]:checked').value;
  
  if (mode === 'time') {
    const minutes = parseFloat(elements.splitMinutes.value);
    if (isNaN(minutes) || minutes <= 0) {
      showError('分割間隔は0より大きい数値を入力してください。');
      return;
    }
    if (minutes * 60 > audioBuffer.duration) {
      showError('分割間隔がファイルの長さより長いです。');
      return;
    }
  } else if (mode === 'parts') {
    const parts = parseInt(elements.splitParts.value);
    if (isNaN(parts) || parts < 2) {
      showError('分割個数は2以上の整数を入力してください。');
      return;
    }
    if (parts > 50) {
      showError('分割個数は50以下にしてください。');
      return;
    }
  } else if (mode === 'markers') {
    if (!waveformEnhanced || waveformEnhanced.getSplitMarkers().length === 0) {
      showError('波形上でShift+クリックして分割位置をマークしてください。');
      return;
    }
  }
  
  showSection('processing');
  
  try {
    const segments = calculateSegments(mode);
    
    if (segments.length === 0) {
      throw new Error('セグメントの生成に失敗しました。');
    }
    
    await processSegments(segments);
    
    showSection('results');
    showSuccess(`${segments.length}個のファイルに分割しました`);
    
  } catch (error) {
    console.error('分割処理エラー:', error);
    showError('分割処理中にエラーが発生しました: ' + error.message);
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
      const segment = {
        start,
        end,
        name: ''
      };
      segment.name = generateFileName(partNumber, segment);
      segments.push(segment);
      start = end;
      partNumber++;
    }
  } else if (mode === 'parts') {
    const parts = parseInt(elements.splitParts.value);
    const partDuration = duration / parts;
    
    for (let i = 0; i < parts; i++) {
      const segment = {
        start: i * partDuration,
        end: Math.min((i + 1) * partDuration, duration),
        name: ''
      };
      segment.name = generateFileName(i + 1, segment);
      segments.push(segment);
    }
  } else if (mode === 'markers') {
    if (!waveformEnhanced) return segments;
    
    const markers = waveformEnhanced.getSplitMarkers();
    if (markers.length === 0) return segments;
    
    // マーカーをソート（念のため）
    const sortedMarkers = [...markers].sort((a, b) => a - b);
    
    // 最初のセグメント（開始からマーカー1まで）
    if (sortedMarkers[0] > 0) {
      const segment = {
        start: 0,
        end: sortedMarkers[0],
        name: ''
      };
      segment.name = generateFileName(1, segment);
      segments.push(segment);
    }
    
    // マーカー間のセグメント
    for (let i = 0; i < sortedMarkers.length - 1; i++) {
      const segment = {
        start: sortedMarkers[i],
        end: sortedMarkers[i + 1],
        name: ''
      };
      segment.name = generateFileName(segments.length + 1, segment);
      segments.push(segment);
    }
    
    // 最後のセグメント（最後のマーカーから終端まで）
    const lastMarker = sortedMarkers[sortedMarkers.length - 1];
    if (lastMarker < duration) {
      const segment = {
        start: lastMarker,
        end: duration,
        name: ''
      };
      segment.name = generateFileName(segments.length + 1, segment);
      segments.push(segment);
    }
  }
  
  return segments;
}

/**
 * ファイル名生成
 */
function generateFileName(partNumber, segment) {
  const prefix = elements.filePrefix.value || currentFile.name.replace(/\.[^/.]+$/, '');
  const pattern = elements.namingPattern?.value || 'simple';
  
  // 日時情報の取得
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
  
  // 時間フォーマット用ヘルパー関数
  const formatTimeForName = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}m${secs}s`;
  };
  
  let fileName;
  
  switch (pattern) {
    case 'simple':
      fileName = `${prefix}_part${partNumber.toString().padStart(2, '0')}`;
      break;
      
    case 'timestamp':
      fileName = `${prefix}_${dateStr}_${timeStr}_part${partNumber.toString().padStart(2, '0')}`;
      break;
      
    case 'duration':
      if (segment) {
        const startTime = formatTimeForName(segment.start);
        const endTime = formatTimeForName(segment.end);
        fileName = `${prefix}_${startTime}-${endTime}`;
      } else {
        fileName = `${prefix}_part${partNumber.toString().padStart(2, '0')}`;
      }
      break;
      
    case 'custom':
      const customPattern = elements.customPatternInput?.value || '{prefix}_part{num:02d}';
      fileName = customPattern
        .replace('{prefix}', prefix)
        .replace('{original}', currentFile.name.replace(/\.[^/.]+$/, ''))
        .replace('{date}', dateStr)
        .replace('{time}', timeStr)
        .replace('{num}', partNumber.toString())
        .replace(/{num:(\d+)d}/g, (match, digits) => {
          return partNumber.toString().padStart(parseInt(digits), '0');
        });
        
      if (segment) {
        fileName = fileName
          .replace('{start}', formatTimeForName(segment.start))
          .replace('{end}', formatTimeForName(segment.end))
          .replace('{duration}', formatTimeForName(segment.end - segment.start));
      }
      break;
      
    default:
      fileName = `${prefix}_part${partNumber.toString().padStart(2, '0')}`;
  }
  
  return `${fileName}.wav`;
}

/**
 * セグメント処理
 */
async function processSegments(segments) {
  const results = [];
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    updateProgress(i, segments.length, segment.name);
    
    try {
      const segmentBuffer = extractSegment(segment.start, segment.end);
      
      // 空のバッファチェック
      if (segmentBuffer.length === 0) {
        throw new Error('空のセグメントが生成されました');
      }
      
      const blob = await encodeAudioBuffer(segmentBuffer);
      
      results.push({
        name: segment.name,
        blob,
        duration: segment.end - segment.start,
        size: blob.size,
        url: URL.createObjectURL(blob)
      });
      
      // メモリ管理のため、少し待機
      if (i % 10 === 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
    } catch (error) {
      console.error(`セグメント ${segment.name} の処理に失敗:`, error);
      throw new Error(`ファイル "${segment.name}" の生成に失敗しました`);
    }
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
  let progress;
  let text;
  
  if (typeof current === 'number' && typeof total === 'number') {
    if (total === 1) {
      // 単一のプログレス値として扱う（0-1の範囲）
      progress = current * 100;
      text = fileName || '処理中...';
    } else {
      // 複数のアイテム処理
      progress = ((current + 1) / total) * 100;
      text = fileName ? `処理中: ${fileName} (${current + 1}/${total})` : `処理中... (${current + 1}/${total})`;
    }
  } else {
    progress = 0;
    text = fileName || '準備中...';
  }
  
  elements.progressFill.style.width = `${progress}%`;
  elements.progressText.textContent = text;
}

/**
 * 結果表示
 */
function displayResults(results) {
  elements.resultsList.innerHTML = '';
  
  results.forEach((result, index) => {
    const item = document.createElement('div');
    item.className = 'result-item fade-in';
    item.style.animationDelay = `${index * 0.05}s`;
    item.innerHTML = `
      <div class="result-info">
        <div class="result-name">${result.name}</div>
        <div class="result-details">
          <span class="result-duration">${formatTime(result.duration)}</span>
          <span class="result-size">${formatFileSize(result.size)}</span>
        </div>
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
  
  // 合計サイズを計算
  const totalSize = results.reduce((sum, result) => sum + result.size, 0);
  console.log(`分割完了: ${results.length}ファイル, 合計サイズ: ${formatFileSize(totalSize)}`);
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
  if (!window.splitResults || window.splitResults.length === 0) {
    showError('ダウンロードするファイルがありません。');
    return;
  }
  
  // JSZipが読み込まれているか確認
  if (typeof JSZip === 'undefined') {
    showError('ZIP機能が利用できません。ページを再読み込みしてください。');
    return;
  }
  
  // ボタンを無効化してローディング状態に
  elements.downloadAllBtn.disabled = true;
  const originalText = elements.downloadAllBtn.textContent;
  elements.downloadAllBtn.textContent = 'ZIP作成中...';
  
  try {
    // JSZipインスタンスを作成
    const zip = new JSZip();
    
    // 各分割ファイルをZIPに追加
    for (const result of window.splitResults) {
      // Blob URLからBlobを取得
      const response = await fetch(result.url);
      const blob = await response.blob();
      
      // ZIPにファイルを追加
      zip.file(result.name, blob);
    }
    
    // ZIPファイルを生成
    elements.downloadAllBtn.textContent = 'ZIP生成中...';
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 6
      }
    }, (metadata) => {
      // プログレス更新
      const progress = Math.round(metadata.percent);
      elements.downloadAllBtn.textContent = `ZIP生成中... ${progress}%`;
    });
    
    // ダウンロード用のファイル名を生成
    const baseFileName = elements.filePrefix.value || currentFile.name.replace(/\.[^/.]+$/, '');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const zipFileName = `${baseFileName}_split_${timestamp}.zip`;
    
    // ダウンロードリンクを作成してクリック
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = zipFileName;
    link.click();
    
    // メモリ解放
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    
    showSuccess(`${zipFileName} のダウンロードを開始しました`);
    
  } catch (error) {
    console.error('ZIP作成エラー:', error);
    showError('ZIPファイルの作成に失敗しました: ' + error.message);
  } finally {
    // ボタンを元に戻す
    elements.downloadAllBtn.disabled = false;
    elements.downloadAllBtn.textContent = originalText;
  }
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
  pauseTime = 0;
  startTime = 0;
  
  // 拡張波形モジュールのリセット
  if (waveformEnhanced) {
    waveformEnhanced = null;
  }
  
  // UI初期化
  showSection('upload');
  elements.fileInput.value = '';
  elements.filePrefix.value = '';
  
  // 結果クリーンアップ
  if (window.splitResults) {
    window.splitResults.forEach(result => {
      URL.revokeObjectURL(result.url);
    });
    window.splitResults = null;
  }
  
  // メッセージ削除
  const existingMsg = document.querySelector('.message-overlay');
  if (existingMsg) existingMsg.remove();
  
  showSuccess('新しいファイルを処理できます');
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