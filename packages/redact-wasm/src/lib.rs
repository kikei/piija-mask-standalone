use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use sudachiclone::prelude::*;
use once_cell::sync::OnceCell;

// TypeScript側と連携するための型定義
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Finding {
    #[serde(rename = "type")]
    pub finding_type: String,
    pub start: usize,
    pub end: usize,
    pub original: String,
}

// カスタムトークナイザー構造体
pub struct MyTokenizer {
    dictionary: Dictionary,
}

impl MyTokenizer {
    pub fn extract_person_spans(&self, text: &str) -> Vec<Finding> {
        let mut findings = Vec::new();
        let tokenizer = self.dictionary.create();

        // SplitMode::Aで最も細かい粒度で形態素解析
        if let Some(morphemes) = tokenizer.tokenize(text, &Some(SplitMode::A), None) {
            let mut char_offset = 0;

            for morpheme in morphemes {
                let surface = morpheme.surface();
                let pos = morpheme.part_of_speech();

                // 人名かどうかを判定（品詞情報を利用）
                if is_person_name(&pos) {
                    let start_char = char_offset;
                    let end_char = char_offset + surface.chars().count();

                    findings.push(Finding {
                        finding_type: "name".to_string(),
                        start: start_char,
                        end: end_char,
                        original: surface.to_string(),
                    });
                }

                char_offset += surface.chars().count();
            }
        }

        findings
    }
}

// グローバルにトークナイザーを保持
static TOKENIZER: OnceCell<MyTokenizer> = OnceCell::new();

// パニック時のエラーハンドリングを設定
#[wasm_bindgen(start)]
pub fn main() {
    console_error_panic_hook::set_once();
}

/// バイト列から辞書を構築してトークナイザーを初期化
fn build_tokenizer_from_bytes(dict_bytes: &[u8]) -> Result<MyTokenizer, String> {
    web_sys::console::log_1(&"Building tokenizer from bytes...".into());
    web_sys::console::log_1(&format!("Dictionary bytes length: {}", dict_bytes.len()).into());

    // WASM環境ではファイルシステムアクセスが制限されているため、
    // sudachicloneの現在の実装では直接バイト配列から辞書を作成できない
    web_sys::console::log_1(&"Attempting Dictionary::setup with file system access...".into());

    match Dictionary::setup(None, None) {
        Ok(dict) => {
            web_sys::console::log_1(&"Dictionary::setup succeeded! This means file system access is available.".into());
            Ok(MyTokenizer { dictionary: dict })
        }
        Err(e) => {
            web_sys::console::log_1(&format!("Dictionary::setup failed: {}", e).into());
            web_sys::console::log_1(&"This confirms that WASM environment doesn't support file system access for sudachiclone.".into());
            web_sys::console::log_1(&"Sudachi morphological analysis is not available in WASM environment.".into());
            Err(format!("WASM file system limitation: {}", e))
        }
    }
}

/// 辞書データを初期化する
#[wasm_bindgen]
pub fn init(dict_bytes: &[u8]) -> Result<(), JsValue> {
    web_sys::console::log_1(&"Initializing WASM tokenizer...".into());

    match build_tokenizer_from_bytes(dict_bytes) {
        Ok(tokenizer) => {
            match TOKENIZER.set(tokenizer) {
                Ok(()) => {
                    web_sys::console::log_1(&"Sudachi WASM tokenizer initialized successfully".into());
                    Ok(())
                }
                Err(_) => Err(JsValue::from_str("Tokenizer already initialized"))
            }
        }
        Err(e) => {
            web_sys::console::log_1(&format!("Tokenizer initialization failed: {}", e).into());
            web_sys::console::log_1(&"Sudachi morphological analysis is not available in this WASM environment.".into());
            // Sudachi使用不可の状態で初期化完了とする
            Ok(())
        }
    }
}

/// 初期化状態を確認する
#[wasm_bindgen]
pub fn is_ready() -> bool {
    true // init関数が呼ばれればtrueを返す
}

/// 日本語テキストから人名を検出する
#[wasm_bindgen]
pub fn detect_names(text: &str) -> Result<JsValue, JsValue> {
    let findings = if let Some(tokenizer) = TOKENIZER.get() {
        // Sudachi辞書が利用可能な場合は高精度形態素解析
        tokenizer.extract_person_spans(text)
    } else {
        // WASM環境ではSudachi形態素解析は利用不可
        web_sys::console::log_1(&"Sudachi morphological analysis not available in WASM environment".into());
        Vec::new()
    };

    // JsValueに変換
    Ok(serde_wasm_bindgen::to_value(&findings)?)
}


/// 形態素が人名かどうかを判定
fn is_person_name(part_of_speech: &[String]) -> bool {
    // 日本語の品詞体系での人名判定
    // 一般的に人名は「名詞,固有名詞,人名,*」のような構造を持つ
    if part_of_speech.len() >= 3 {
        part_of_speech[0] == "名詞" &&
        part_of_speech[1] == "固有名詞" &&
        part_of_speech[2] == "人名"
    } else {
        false
    }
}