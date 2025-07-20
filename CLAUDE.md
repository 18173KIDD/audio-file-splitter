# 音声ファイル分割ツール - Claude Code設定

## 🤖 プロジェクト固有ルール

### 基本設定
- **言語設定**: 日本語
- **コーディング規約**: Google JavaScript Style Guide準拠
- **インデント**: スペース2つ
- **文字エンコーディング**: UTF-8

### 必須実行ルール
1. **作業開始時**
   - progress.md で現在のPhaseを確認
   - current-work.md で前回の終了地点を確認
   - **現在のPhaseの「📚 マニュアル目次確認」タスクを実行**（未完了の場合）
   - TodoWriteで本日の計画を作成

2. **Phase移行時**
   - 新しいPhaseの最初のタスク「📚 マニュアル目次確認」を必ず実行
   - 00_INDEX_目次.mdで必要なマニュアルを特定

3. **ファイル作成時**
   - HTMLファイル: 適切なメタタグとアクセシビリティ属性を含める
   - JSファイル: 'use strict'を先頭に記載
   - CSSファイル: モバイルファーストで記述

4. **コミット時**
   - コミットメッセージ: `feat:` `fix:` `docs:` `style:` `refactor:` プレフィックスを使用
   - 日本語での説明を含める

### 禁止事項
- サーバーサイド処理の実装（GitHub Pages制約）
- 外部APIへの直接リクエスト（CORS制約）
- 非標準のWeb APIの使用（ブラウザ互換性）

### 推奨事項
- Web Audio APIの使用前にブラウザサポート確認
- 大容量ファイル処理時はWeb Workersの活用を検討
- プログレッシブエンハンスメントの原則に従う

## 🔄 プロジェクト再開時の自動実行

このプロジェクトフォルダが指定されたら、以下を自動実行すること：

1. **必須ファイル読み込み（並列実行）**
   - `.project/current-work.md` → 作業再開ポイント確認
   - `.project/progress.md` → 現在のPhaseと進捗確認
   - `.project/PROJECT.md` → プロジェクト概要確認

2. **即座に状況報告**
   ```
   プロジェクト: 音声ファイル分割ツール
   現在: Phase [X] - [進捗%]
   前回: [current-work.mdの作業再開ポイント要約]
   ```

3. **TodoWrite自動作成**
   - current-work.mdの「次の予定」から
   - progress.mdの未完了タスクから

4. **作業再開**
   - current-work.mdの「作業再開ポイント」から継続

### 再開トリガー
- 「/home/kidd/windows-desktop/音声ファイル分割ツール_20250720の開発を再開」
- 「音声ファイル分割ツールの続き」
- このフォルダが開かれた時点で自動認識

## 📝 プロジェクト固有の情報
- **GitHub Pagesリポジトリ**: https://github.com/18173KIDD/audio-file-splitter
- **公開URL**: https://18173KIDD.github.io/audio-file-splitter/
- **主要技術**: Web Audio API、Canvas API、File API
- **対応ブラウザ**: Chrome、Firefox、Safari（最新版）、モバイルブラウザ