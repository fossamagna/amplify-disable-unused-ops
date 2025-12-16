# amplify-disable-unused-ops

AWS Amplify Gen2のプロジェクトで未使用のGraphQL操作を自動的に検出し、無効化するCLIツールです。

## 概要

このツールは、TypeScriptプロジェクトをスキャンして実際に使用されているAmplify DataClientの操作（query/mutation/subscription）を特定し、未使用の操作を`disableOperations()`で無効化することで、不要なAPIエンドポイントの生成を防ぎます。

## 主な機能

- **使用状況のスキャン**: プロジェクト内のTypeScriptファイルを解析し、実際に使用されているモデルとその操作を検出
- **自動無効化**: 未使用の操作を`disableOperations()`で自動的に無効化
- **バックアップ**: 変更前にリソースファイルのバックアップを自動作成（オプション）
- **ドライラン**: 実際に変更を加える前にプレビュー可能

## インストール

```bash
npm add -D amplify-disable-unused-ops
```

## 使用方法

### 1. 使用状況のスキャン

プロジェクト内のTypeScriptファイルをスキャンし、使用されているAmplify操作を検出します。

```bash
amplify-disable-unused-ops scan --project tsconfig.json --out usage.json
```

**オプション:**
- `--project`: TypeScriptプロジェクトの設定ファイル（tsconfig.json）のパス
- `--out`: 使用状況を出力するJSONファイルのパス

**出力例（usage.json）:**
```json
{
  "Todo": ["create", "list"],
  "User": ["get", "update"]
}
```

### 2. 未使用操作の無効化

スキャン結果に基づいて、Amplifyリソースファイルを更新し、未使用の操作を無効化します。

```bash
amplify-disable-unused-ops apply --resource amplify/data/resource.ts --usage usage.json
```

**オプション:**
- `--resource`: Amplifyのリソース定義ファイル（resource.ts）のパス
- `--usage`: スキャンで生成した使用状況JSONファイルのパス
- `--dry-run`: 実際に変更を加えずにプレビューのみ実行
- `--no-backup`: バックアップファイルを作成しない（デフォルトは作成する）

**ドライランの例:**
```bash
amplify-disable-unused-ops apply --resource amplify/data/resource.ts --usage usage.json --dry-run
```

## 操作の種類

このツールは以下の操作タイプを検出・管理します：

### クエリ操作
- `get`: 単一レコードの取得
- `list`: 複数レコードの一覧取得

### ミューテーション操作
- `create`: レコードの作成
- `update`: レコードの更新
- `delete`: レコードの削除

### サブスクリプション操作
- `onCreate`: 作成時のリアルタイム通知
- `onUpdate`: 更新時のリアルタイム通知
- `onDelete`: 削除時のリアルタイム通知
- `observeQuery`: クエリ結果のリアルタイム監視

## 仕組み

1. **スキャンフェーズ**: `ts-morph`を使用してTypeScriptのASTを解析し、`generateClient()`で生成されたクライアントインスタンスを追跡
2. **解析フェーズ**: `client.models.ModelName.operation()`の形式で呼び出されている操作を検出
3. **適用フェーズ**: 検出された使用状況に基づき、未使用の操作グループ（queries/mutations/subscriptions）を`disableOperations()`で無効化

## 技術スタック

- **TypeScript**: 型安全な開発
- **ts-morph**: TypeScript ASTの解析と操作
- **Node.js**: ランタイム環境

## 開発

### ビルド
```bash
npm run build
```

### 実行
```bash
npm start
```

## ライセンス

MIT
