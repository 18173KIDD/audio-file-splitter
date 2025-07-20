# プロジェクト参照情報

## 初期調査 (2025-07-20 09:50)

### 公式ドキュメント
- **Web Audio API v1.0**
  - URL: https://g200kg.github.io/web-audio-api-ja/
  - 概要: W3C勧告となったWeb Audio APIの日本語訳
  - 重要: AudioBuffer、AudioWorklet、AnalyserNodeが音声処理の基本

- **MDN Web Audio API**
  - URL: https://developer.mozilla.org/ja/docs/Web/API/Web_Audio_API
  - 概要: Web Audio APIの包括的なドキュメント
  - 学び: AudioWorkletが推奨される処理方法（ScriptProcessorNodeは非推奨）

### 類似プロジェクト
- **Audio-trimmer**
  - URL: https://github.com/sourabhkumarsahu/Audio-trimmer
  - Stars: 不明
  - 概要: シンプルでエレガントな音声トリミングWebアプリ
  - 参考ポイント: UIデザイン、基本的な音声編集機能

- **audioTrimmer**
  - URL: https://github.com/SukarayamJanjua/audioTrimmer
  - 概要: 単一ワークスペースで全音声編集ツールを提供
  - 参考ポイント: 統合的なアプローチ

- **mp3-cutter**
  - URL: https://github.com/alexcoliveira1/mp3-cutter
  - 概要: JavaScriptライブラリ、秒単位でMP3カット
  - 参考ポイント: MP3特化の処理方法

### 技術記事
- **Web Audio APIを使ってみた**
  - URL: https://qiita.com/Q_Udon/items/4e66555223f8e923e091
  - 概要: Web Audio APIの実践的な使用例
  - 学び: 基本的な実装パターン

- **ffmpeg.wasm解説記事**
  - URL: https://blog.scottlogic.com/2020/11/23/ffmpeg-webassembly.html
  - 概要: ブラウザ内でのFFmpeg使用方法
  - 学び: WebAssemblyを使った高度な音声処理

### ライブラリ仕様
- **ffmpeg.wasm**
  - URL: https://github.com/ffmpegwasm/ffmpeg.wasm
  - 概要: FFmpegのWebAssembly版
  - 重要: GitHub PagesでCORS設定が必要（'Cross-Origin-Embedder-Policy': 'require-corp'）
  - 利点: 幅広い音声形式対応、高度な処理機能

- **ffmpeg.audio.wasm**
  - URL: https://github.com/JorenSix/ffmpeg.audio.wasm
  - 概要: 音声特化のFFmpegビルド
  - 利点: より軽量、音声処理に最適化

## 追加調査
（開発中に調査した内容を自動追記）

## 開発方針決定 (2025-07-20 10:10)

### 選択した方針
**A. Web Audio APIのみで実装**

### 決定理由
- 個人用途に最適な軽量実装
- GitHub Pagesで追加設定不要
- 主要音声形式は十分にカバー
- モバイル環境でも快適に動作

### 技術的制約の受容
- 対応形式：MP3、WAV、OGG、M4A（ブラウザ依存）
- 高度な音声処理は非対応
- 将来的な拡張性は確保（ffmpeg.wasm追加可能）