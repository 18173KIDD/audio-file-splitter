'use strict';

/**
 * 拡張波形表示モジュール
 * より高度な波形表示とインタラクティブ機能を提供
 */

class WaveformEnhanced {
  constructor(canvas, audioBuffer) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audioBuffer = audioBuffer;
    
    // 表示設定
    this.zoom = 1;
    this.offset = 0;
    this.playheadPosition = 0;
    this.splitMarkers = [];
    this.hoveredSplitMarker = null;
    
    // カラー設定
    this.colors = {
      waveform: '#2563eb',
      waveformHover: '#3b82f6',
      background: '#ffffff',
      playhead: '#ef4444',
      splitMarker: '#10b981',
      splitMarkerHover: '#059669',
      grid: '#e5e7eb',
      text: '#6b7280'
    };
    
    // インタラクション設定
    this.isMouseDown = false;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartOffset = 0;
    
    // タッチ/ピンチズーム設定
    this.isPinching = false;
    this.pinchStartDistance = 0;
    this.pinchStartZoom = 1;
    this.longTapTimer = null;
    this.longTapStartX = 0;
    
    this.setupCanvas();
    this.setupEventListeners();
  }
  
  /**
   * キャンバスの初期設定
   */
  setupCanvas() {
    // 高DPI対応
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    
    this.width = rect.width;
    this.height = rect.height;
  }
  
  /**
   * イベントリスナーの設定
   */
  setupEventListeners() {
    // マウスイベント
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
    this.canvas.addEventListener('click', this.handleClick.bind(this));
    
    // ホイールイベント（ズーム）
    this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
    
    // タッチイベント（モバイル対応）
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
    this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
    this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
    
    // リサイズ対応
    window.addEventListener('resize', () => {
      this.setupCanvas();
      this.draw();
    });
  }
  
  /**
   * 波形の描画
   */
  draw() {
    const ctx = this.ctx;
    
    // 背景クリア
    ctx.fillStyle = this.colors.background;
    ctx.fillRect(0, 0, this.width, this.height);
    
    // グリッド描画
    this.drawGrid();
    
    // 波形描画
    this.drawWaveform();
    
    // 分割マーカー描画
    this.drawSplitMarkers();
    
    // 再生位置描画
    this.drawPlayhead();
    
    // タイムラベル描画
    this.drawTimeLabels();
  }
  
  /**
   * グリッドの描画
   */
  drawGrid() {
    const ctx = this.ctx;
    ctx.strokeStyle = this.colors.grid;
    ctx.lineWidth = 0.5;
    
    // 水平線（中央）
    ctx.beginPath();
    ctx.moveTo(0, this.height / 2);
    ctx.lineTo(this.width, this.height / 2);
    ctx.stroke();
    
    // 垂直線（時間軸）
    const duration = this.audioBuffer.duration;
    const visibleDuration = duration / this.zoom;
    const startTime = (this.offset / this.width) * visibleDuration;
    const endTime = startTime + visibleDuration;
    
    // 適切な間隔を計算
    const interval = this.calculateTimeInterval(visibleDuration);
    const firstLine = Math.ceil(startTime / interval) * interval;
    
    ctx.beginPath();
    for (let time = firstLine; time <= endTime; time += interval) {
      const x = ((time - startTime) / visibleDuration) * this.width;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
    }
    ctx.stroke();
  }
  
  /**
   * 時間間隔の計算
   */
  calculateTimeInterval(duration) {
    const intervals = [0.1, 0.5, 1, 5, 10, 30, 60, 300, 600];
    const targetLines = 10;
    
    for (const interval of intervals) {
      if (duration / interval <= targetLines) {
        return interval;
      }
    }
    
    return Math.ceil(duration / targetLines);
  }
  
  /**
   * 波形の描画
   */
  drawWaveform() {
    const ctx = this.ctx;
    const data = this.audioBuffer.getChannelData(0);
    const duration = this.audioBuffer.duration;
    const visibleDuration = duration / this.zoom;
    const startTime = (this.offset / this.width) * visibleDuration;
    const endTime = startTime + visibleDuration;
    
    const startSample = Math.floor((startTime / duration) * data.length);
    const endSample = Math.ceil((endTime / duration) * data.length);
    const samples = endSample - startSample;
    
    const step = Math.max(1, Math.floor(samples / this.width));
    const amp = this.height / 2;
    
    // 波形パスの作成
    ctx.beginPath();
    ctx.moveTo(0, amp);
    ctx.strokeStyle = this.colors.waveform;
    ctx.lineWidth = 1;
    
    for (let i = 0; i < this.width; i++) {
      const sampleIndex = startSample + Math.floor((i / this.width) * samples);
      let min = 1.0;
      let max = -1.0;
      
      for (let j = 0; j < step && sampleIndex + j < data.length; j++) {
        const datum = data[sampleIndex + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      
      ctx.lineTo(i, (1 + min) * amp);
      ctx.lineTo(i, (1 + max) * amp);
    }
    
    ctx.stroke();
  }
  
  /**
   * 分割マーカーの描画
   */
  drawSplitMarkers() {
    const ctx = this.ctx;
    const duration = this.audioBuffer.duration;
    const visibleDuration = duration / this.zoom;
    const startTime = (this.offset / this.width) * visibleDuration;
    
    this.splitMarkers.forEach((marker, index) => {
      const x = ((marker - startTime) / visibleDuration) * this.width;
      
      if (x >= 0 && x <= this.width) {
        ctx.strokeStyle = index === this.hoveredSplitMarker ? 
          this.colors.splitMarkerHover : this.colors.splitMarker;
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.height);
        ctx.stroke();
        
        // マーカー番号の表示
        ctx.fillStyle = ctx.strokeStyle;
        ctx.font = '12px sans-serif';
        ctx.fillText(`${index + 1}`, x + 4, 16);
      }
    });
  }
  
  /**
   * 再生位置の描画
   */
  drawPlayhead() {
    const ctx = this.ctx;
    const duration = this.audioBuffer.duration;
    const visibleDuration = duration / this.zoom;
    const startTime = (this.offset / this.width) * visibleDuration;
    
    const x = ((this.playheadPosition - startTime) / visibleDuration) * this.width;
    
    if (x >= 0 && x <= this.width) {
      ctx.strokeStyle = this.colors.playhead;
      ctx.lineWidth = 2;
      
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
      
      // 三角形のインジケーター
      ctx.fillStyle = this.colors.playhead;
      ctx.beginPath();
      ctx.moveTo(x - 6, 0);
      ctx.lineTo(x + 6, 0);
      ctx.lineTo(x, 10);
      ctx.closePath();
      ctx.fill();
    }
  }
  
  /**
   * 時間ラベルの描画
   */
  drawTimeLabels() {
    const ctx = this.ctx;
    const duration = this.audioBuffer.duration;
    const visibleDuration = duration / this.zoom;
    const startTime = (this.offset / this.width) * visibleDuration;
    const endTime = startTime + visibleDuration;
    
    ctx.fillStyle = this.colors.text;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    
    const interval = this.calculateTimeInterval(visibleDuration);
    const firstLine = Math.ceil(startTime / interval) * interval;
    
    for (let time = firstLine; time <= endTime; time += interval) {
      const x = ((time - startTime) / visibleDuration) * this.width;
      const label = this.formatTime(time);
      ctx.fillText(label, x, this.height - 4);
    }
  }
  
  /**
   * 時間のフォーマット
   */
  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    
    if (minutes > 0) {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${secs}.${ms}`;
    }
  }
  
  /**
   * マウスダウンハンドラ
   */
  handleMouseDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    this.isMouseDown = true;
    this.dragStartX = x;
    this.dragStartOffset = this.offset;
    
    // Shift押しながらクリックで分割マーカー追加
    if (e.shiftKey) {
      this.addSplitMarkerAtX(x);
    }
  }
  
  /**
   * マウス移動ハンドラ
   */
  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    if (this.isMouseDown && !e.shiftKey) {
      // ドラッグでパン
      this.isDragging = true;
      const delta = x - this.dragStartX;
      this.offset = Math.max(0, Math.min(this.width * (this.zoom - 1), 
        this.dragStartOffset - delta * this.zoom));
      this.draw();
    } else {
      // 分割マーカーのホバー検出
      this.checkSplitMarkerHover(x);
    }
    
    // カーソル変更
    this.canvas.style.cursor = this.isDragging ? 'grabbing' : 
      (e.shiftKey ? 'crosshair' : 'grab');
  }
  
  /**
   * マウスアップハンドラ
   */
  handleMouseUp(e) {
    this.isMouseDown = false;
    this.isDragging = false;
  }
  
  /**
   * マウスリーブハンドラ
   */
  handleMouseLeave(e) {
    this.isMouseDown = false;
    this.isDragging = false;
    this.hoveredSplitMarker = null;
    this.draw();
  }
  
  /**
   * クリックハンドラ
   */
  handleClick(e) {
    if (this.isDragging) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    if (!e.shiftKey && !e.ctrlKey) {
      // 通常クリックでシーク
      this.seekToX(x);
    } else if (e.ctrlKey && this.hoveredSplitMarker !== null) {
      // Ctrl+クリックで分割マーカー削除
      this.removeSplitMarker(this.hoveredSplitMarker);
    }
  }
  
  /**
   * ホイールハンドラ（ズーム）
   */
  handleWheel(e) {
    e.preventDefault();
    
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    
    // ズーム前の位置を記憶
    const duration = this.audioBuffer.duration;
    const visibleDuration = duration / this.zoom;
    const startTime = (this.offset / this.width) * visibleDuration;
    const mouseTime = startTime + (x / this.width) * visibleDuration;
    
    // ズーム適用
    this.zoom = Math.max(1, Math.min(20, this.zoom * delta));
    
    // マウス位置を中心にズーム
    const newVisibleDuration = duration / this.zoom;
    const newStartTime = mouseTime - (x / this.width) * newVisibleDuration;
    this.offset = (newStartTime / newVisibleDuration) * this.width;
    this.offset = Math.max(0, Math.min(this.width * (this.zoom - 1), this.offset));
    
    this.draw();
  }
  
  /**
   * タッチ開始ハンドラ
   */
  handleTouchStart(e) {
    e.preventDefault(); // ダブルタップズームを防ぐ
    
    const touch = e.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    
    // ピンチズームの準備
    if (e.touches.length === 2) {
      this.isPinching = true;
      this.pinchStartDistance = this.getPinchDistance(e.touches);
      this.pinchStartZoom = this.zoom;
      
      // ロングタップタイマーをクリア
      if (this.longTapTimer) {
        clearTimeout(this.longTapTimer);
        this.longTapTimer = null;
      }
    } else {
      // ロングタップ検出
      const x = touch.clientX - rect.left;
      this.longTapStartX = x;
      
      this.longTapTimer = setTimeout(() => {
        // ロングタップで分割マーカー追加
        this.addSplitMarkerAtX(x);
        
        // バイブレーションフィードバック（対応デバイスのみ）
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
        
        this.longTapTimer = null;
      }, 500); // 500ms長押しで発動
      
      this.handleMouseDown({
        clientX: touch.clientX,
        clientY: touch.clientY,
        shiftKey: false
      });
    }
  }
  
  /**
   * タッチ移動ハンドラ
   */
  handleTouchMove(e) {
    e.preventDefault();
    
    // ロングタップのキャンセル（移動したら）
    if (this.longTapTimer && e.touches.length === 1) {
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      
      // 10px以上移動したらロングタップをキャンセル
      if (Math.abs(x - this.longTapStartX) > 10) {
        clearTimeout(this.longTapTimer);
        this.longTapTimer = null;
      }
    }
    
    if (this.isPinching && e.touches.length === 2) {
      // ピンチズーム処理
      const currentDistance = this.getPinchDistance(e.touches);
      const scale = currentDistance / this.pinchStartDistance;
      this.zoom = Math.max(1, Math.min(20, this.pinchStartZoom * scale));
      
      // ピンチの中心点を基準にズーム
      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const rect = this.canvas.getBoundingClientRect();
      const x = centerX - rect.left;
      
      const duration = this.audioBuffer.duration;
      const visibleDuration = duration / this.pinchStartZoom;
      const startTime = (this.offset / this.width) * visibleDuration;
      const mouseTime = startTime + (x / this.width) * visibleDuration;
      
      const newVisibleDuration = duration / this.zoom;
      const newStartTime = mouseTime - (x / this.width) * newVisibleDuration;
      this.offset = (newStartTime / newVisibleDuration) * this.width;
      this.offset = Math.max(0, Math.min(this.width * (this.zoom - 1), this.offset));
      
      this.draw();
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      this.handleMouseMove({
        clientX: touch.clientX,
        clientY: touch.clientY,
        shiftKey: false
      });
    }
  }
  
  /**
   * タッチ終了ハンドラ
   */
  handleTouchEnd(e) {
    this.isPinching = false;
    
    // ロングタップタイマーをクリア
    if (this.longTapTimer) {
      clearTimeout(this.longTapTimer);
      this.longTapTimer = null;
    }
    
    this.handleMouseUp(e);
  }
  
  /**
   * ピンチ距離の計算
   */
  getPinchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  /**
   * 分割マーカーの追加
   */
  addSplitMarkerAtX(x) {
    const duration = this.audioBuffer.duration;
    const visibleDuration = duration / this.zoom;
    const startTime = (this.offset / this.width) * visibleDuration;
    const time = startTime + (x / this.width) * visibleDuration;
    
    if (time >= 0 && time <= duration) {
      this.splitMarkers.push(time);
      this.splitMarkers.sort((a, b) => a - b);
      this.draw();
      
      // 分割マーカー変更イベントを発火
      this.canvas.dispatchEvent(new CustomEvent('splitMarkersChanged', {
        detail: { markers: this.splitMarkers }
      }));
    }
  }
  
  /**
   * 分割マーカーの削除
   */
  removeSplitMarker(index) {
    this.splitMarkers.splice(index, 1);
    this.hoveredSplitMarker = null;
    this.draw();
    
    // 分割マーカー変更イベントを発火
    this.canvas.dispatchEvent(new CustomEvent('splitMarkersChanged', {
      detail: { markers: this.splitMarkers }
    }));
  }
  
  /**
   * 分割マーカーホバーチェック
   */
  checkSplitMarkerHover(x) {
    const duration = this.audioBuffer.duration;
    const visibleDuration = duration / this.zoom;
    const startTime = (this.offset / this.width) * visibleDuration;
    
    let hoveredIndex = null;
    const tolerance = 5; // ピクセル単位の許容範囲
    
    this.splitMarkers.forEach((marker, index) => {
      const markerX = ((marker - startTime) / visibleDuration) * this.width;
      if (Math.abs(markerX - x) <= tolerance) {
        hoveredIndex = index;
      }
    });
    
    if (hoveredIndex !== this.hoveredSplitMarker) {
      this.hoveredSplitMarker = hoveredIndex;
      this.draw();
    }
  }
  
  /**
   * 指定位置へのシーク
   */
  seekToX(x) {
    const duration = this.audioBuffer.duration;
    const visibleDuration = duration / this.zoom;
    const startTime = (this.offset / this.width) * visibleDuration;
    const time = startTime + (x / this.width) * visibleDuration;
    
    if (time >= 0 && time <= duration) {
      // シークイベントを発火
      this.canvas.dispatchEvent(new CustomEvent('seek', {
        detail: { time }
      }));
    }
  }
  
  /**
   * 再生位置の更新
   */
  updatePlayhead(time) {
    this.playheadPosition = time;
    
    // 自動スクロール（再生位置が画面外に出たら）
    if (this.zoom > 1) {
      const duration = this.audioBuffer.duration;
      const visibleDuration = duration / this.zoom;
      const startTime = (this.offset / this.width) * visibleDuration;
      const endTime = startTime + visibleDuration;
      
      if (time < startTime || time > endTime) {
        // 再生位置を中央に表示
        const newStartTime = Math.max(0, time - visibleDuration / 2);
        this.offset = (newStartTime / visibleDuration) * this.width;
        this.offset = Math.max(0, Math.min(this.width * (this.zoom - 1), this.offset));
      }
    }
    
    this.draw();
  }
  
  /**
   * 分割マーカーの設定
   */
  setSplitMarkers(markers) {
    this.splitMarkers = [...markers];
    this.draw();
  }
  
  /**
   * 分割マーカーの取得
   */
  getSplitMarkers() {
    return [...this.splitMarkers];
  }
  
  /**
   * ズームレベルのリセット
   */
  resetZoom() {
    this.zoom = 1;
    this.offset = 0;
    this.draw();
  }
}

// グローバルに公開
window.WaveformEnhanced = WaveformEnhanced;