// --- Global Variables & Initial Setup ---
let uploadedFile = null;
let translationMemory = JSON.parse(localStorage.getItem('translationMemory') || '{}');
let firstChunkTime = 0;
let failedChunksData = []; // <-- NEW: Store { index, chunkData, reason } for failed chunks
let currentAllTranslatedEntries = []; // <-- NEW: Store the current state of translated entries
let currentOriginalFileName = 'translation'; // <-- NEW: Store filename base
let currentOriginalFormat = 'srt'; // Default to srt, will be updated on file upload
let currentLang = 'English'; // <-- NEW: Store target language
let currentApiKey = ''; // <-- NEW: Store API key
let currentBaseDelay = 1000; // <-- NEW: Store settings
let currentQuotaDelay = 60000;
let currentModel = 'gemini-1.5-flash-latest';
let currentPromptTemplate = '';
let currentTemperature = 0.7;
let currentTopP = 0.95;
let currentTopK = 40;
let currentMaxOutputTokens = 8192;
let currentStopSequencesStr = '';

// Set the specific proxy URL
const proxyUrl = 'https://middleman.yebekhe.workers.dev';

// --- DOM Element References ---
const htmlElement = document.documentElement;
const themeToggle = document.getElementById('themeToggle');
const languageToggle = document.getElementById('languageToggle');
const clearMemoryButton = document.getElementById('clear-memory-button');
const translateForm = document.getElementById('translate-form');
const dropzoneElement = document.getElementById("dropzone-upload");
const srtTextInput = document.getElementById('srt_text');
const apiKeyInput = document.getElementById('api_key');
const rememberMeCheckbox = document.getElementById('remember_me');
const useProxyCheckbox = document.getElementById('useProxyCheckbox');
const togglePasswordBtn = document.getElementById('togglePasswordBtn');
const langInput = document.getElementById('lang-input');
const baseDelayInput = document.getElementById('base_delay');
const quotaDelayInput = document.getElementById('quota_delay');
const chunkCountInput = document.getElementById('chunk_count');
const modelSelect = document.getElementById('model');
const donateButton = document.getElementById('donateButton');
const temperatureInput = document.getElementById('temperature');
const topPInput = document.getElementById('top_p');
const topKInput = document.getElementById('top_k');
const maxOutputTokensInput = document.getElementById('max_output_tokens');
const stopSequencesInput = document.getElementById('stop_sequences');
const translationPromptTextarea = document.getElementById('translation_prompt');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress');
const progressText = document.getElementById('progress-text');
const chunkStatusSpan = document.getElementById('chunk-status');
const timeEstimateSpan = document.getElementById('time-estimate');
const downloadLinkContainer = document.getElementById('download-link');
const errorMessageDiv = document.getElementById('error-message');
const submitButton = document.getElementById('submit-button');
const submitButtonText = submitButton.querySelector('.button-text');
const fileInputSection = document.getElementById('file-input');
const textInputSection = document.getElementById('text-input');
const inputMethodRadios = document.querySelectorAll('input[name="input_method"]');
const apiKeyNote = document.getElementById('api-key-note');
const pageTitle = document.getElementById('page-title');
const uploadInstructions = document.getElementById('upload-instructions');
const warningMessage = document.getElementById('warning-message');
const inputMethodLabel = document.getElementById('input-method-label');
const fileLabel = document.getElementById('file-label');
const textLabel = document.getElementById('text-label');
const apiKeyLabel = document.getElementById('api-key-label');
const rememberMeLabel = document.getElementById('remember-me-label');
const langLabel = document.getElementById('lang-label');
const advancedSettingsSummaryText = document.getElementById('advanced-settings-summary-text'); // Target text span
const useProxyLabel = document.getElementById('use-proxy-label');
const modelLabel = document.getElementById('model-label');
const baseDelayLabel = document.getElementById('base-delay-label');
const quotaDelayLabel = document.getElementById('quota-delay-label');
const chunkCountLabel = document.getElementById('chunk-count-label');
const translationPromptLabel = document.getElementById('translation-prompt-label');


// --- Dropzone Configuration ---
Dropzone.autoDiscover = false;
if (dropzoneElement) {
    try { // Add try-catch for safety
        const myDropzone = new Dropzone(dropzoneElement, {
            url: "#", // Dummy URL
            autoProcessQueue: false,
            acceptedFiles: ".srt,.vtt,.ssa,.ass",
            maxFiles: 1,
            addRemoveLinks: true,
            dictDefaultMessage: dropzoneElement.querySelector('.dz-message') ? dropzoneElement.querySelector('.dz-message').innerHTML : "<p>Drop files here or click to upload.</p>",
            dictRemoveFile: "Remove",
            dictMaxFilesExceeded: "You can only upload one file.",
            dictInvalidFileType: "You can only upload .srt, .vtt, .ssa, or .ass files.",
            init: function() {
                this.on("addedfile", function(file) {
                    if (this.files.length > 1) {
                        this.removeFile(this.files[0]);
                    }
                    uploadedFile = file;
                    const fileExtension = file.name.split('.').pop()?.toLowerCase();
                    if (['srt', 'vtt', 'ssa', 'ass'].includes(fileExtension)) {
                        currentOriginalFormat = fileExtension;
                        console.log(`Detected format: ${currentOriginalFormat}`);
                    } else {
                        currentOriginalFormat = 'srt'; // Fallback or handle error
                        console.warn(`Unknown extension: ${fileExtension}, assuming SRT.`);
                    }
                    hideError();
                    console.log("File added:", file.name);
                });
                this.on("removedfile", function(file) {
                    uploadedFile = null;
                    console.log("File removed:", file.name);
                });
                this.on("error", function(file, errorMsg) {
                    console.error("Dropzone error:", errorMsg);
                    let userMessage = "Error adding file.";
                    if (typeof errorMsg === 'string') {
                        if (errorMsg.includes("You can only upload")) userMessage = errorMsg;
                        else if (errorMsg.includes("File is too big")) userMessage = "File is too large.";
                        else userMessage = "Invalid file. Please ensure it's a valid .srt, .vtt, .ssa, or .ass file.";
                    }
                    showError(userMessage);
                    if (file.previewElement) {
                        const removeLink = file.previewElement.querySelector("[data-dz-remove]");
                        if (removeLink) { removeLink.click(); }
                        else { file.previewElement.remove(); }
                    }
                    uploadedFile = null;
                    currentOriginalFormat = 'srt'; // Reset format
                });
            }
        });
    } catch (e) {
        console.error("Failed to initialize Dropzone:", e);
        if (dropzoneElement) {
            dropzoneElement.textContent = "Error initializing file drop zone.";
            dropzoneElement.style.border = "2px dashed var(--error-color)";
        }
    }
} else {
    console.warn("Dropzone element '#dropzone-upload' not found.");
}

// --- Theme Management ---
function updateTheme(setLight) { // Parameter indicates the desired state
    const themeIcon = themeToggle?.querySelector('i');
    if (!themeIcon) return; // Safety check

    htmlElement.classList.toggle('dark-mode', !setLight); // Add dark-mode if setLight is false

    if (setLight) {
        themeIcon.classList.remove('fa-moon');
        themeIcon.classList.add('fa-sun');
    } else {
        themeIcon.classList.remove('fa-sun');
        themeIcon.classList.add('fa-moon');
    }
    localStorage.setItem('theme', setLight ? 'light' : 'dark');
    console.log(`Theme set to ${setLight ? 'light' : 'dark'}`);
}

// --- Language Management ---
function updateLanguage(lang) {
    const isRTL = lang === 'Persian';
    htmlElement.classList.toggle('rtl-text', isRTL);

    // Footer Elements
    const footerPersian = document.querySelector('.footer p:first-child');
    const footerEnglish = document.querySelector('.footer p:nth-child(2)');
    const textPasteNote = document.getElementById('text-paste-note');

    try {
        if (isRTL) {
            htmlElement.lang = 'fa';
            // Show Persian footer, hide English
            if (footerPersian) footerPersian.style.display = 'block';
            if (footerEnglish) footerEnglish.style.display = 'none';

            if (pageTitle) pageTitle.textContent = 'مترجم زیرنویس';
            if (uploadInstructions) uploadInstructions.textContent = 'فایل SRT، VTT، SSA یا ASS را بارگذاری یا محتوای SRT را الصاق کنید، کلید API Gemini و زبان مقصد را ارائه دهید.';
            if (textPasteNote) textPasteNote.textContent = 'توجه: الصاق متن در حال حاضر فقط از فرمت SRT پشتیبانی می‌کند. برای VTT/SSA/ASS، لطفاً از بارگذاری فایل استفاده کنید.';
            if (warningMessage) warningMessage.textContent = '⚠️ اگر در ایران هستید، برای دسترسی به API Gemini به دلیل تحریم، «استفاده از پروکسی» را در تنظیمات پیشرفته فعال کنید.';
            const advancedWarning = document.querySelector('.advanced-warning-message'); // Target advanced warning specifically
            if (advancedWarning) advancedWarning.textContent = '⚠️ تنظیم این پارامترها می‌تواند بر عملکرد، هزینه و کیفیت ترجمه تأثیر بگذارد. با احتیاط عمل کنید.';
            if (inputMethodLabel) inputMethodLabel.textContent = 'روش ورودی:';
            const fileRadioLabel = document.querySelector('label.radio-label:has(input[value="file"])');
            if (fileRadioLabel) fileRadioLabel.lastChild.textContent = ' بارگذاری فایل';
            const textRadioLabel = document.querySelector('label.radio-label:has(input[value="text"])');
            if (textRadioLabel) textRadioLabel.lastChild.textContent = ' الصاق متن';
            if (fileLabel) fileLabel.textContent = 'بارگذاری فایل زیرنویس (SRT, VTT, SSA, ASS):';
            if (textLabel) textLabel.textContent = 'الصاق محتوای SRT:';
            if (apiKeyLabel) apiKeyLabel.textContent = 'کلید API Gemini:';
            if (apiKeyInput) apiKeyInput.placeholder = 'کلید API خود را وارد کنید';
            if (rememberMeLabel) rememberMeLabel.textContent = 'ذخیره کلید API';
            if (langLabel) langLabel.textContent = 'زبان مقصد:';
            if (langInput) langInput.placeholder = 'مثال: انگلیسی، فرانسوی';
            if (advancedSettingsSummaryText) advancedSettingsSummaryText.textContent = 'تنظیمات پیشرفته';
            if (useProxyLabel) useProxyLabel.textContent = 'استفاده از پروکسی';
            const rememberMeNote = rememberMeLabel?.closest('.checkbox-group')?.querySelector('.note');
            if (rememberMeNote) rememberMeNote.textContent = '(در حافظه محلی ذخیره می‌شود)';
             const useProxyNote = useProxyLabel?.closest('.checkbox-group')?.querySelector('.note');
            if (useProxyNote) useProxyNote.textContent = 'اگر دسترسی مستقیم به Gemini مسدود است فعال کنید.';
            if (modelLabel) modelLabel.textContent = 'مدل Gemini:';
            const modelNote = modelLabel?.closest('.form-group')?.querySelector('.note');
            if (modelNote) modelNote.textContent = 'مدل هوش مصنوعی برای ترجمه را انتخاب کنید.';
            if (baseDelayLabel) baseDelayLabel.textContent = 'تأخیر پایه (ms):';
            const baseDelayNote = baseDelayLabel?.closest('.form-group')?.querySelector('.note');
            if(baseDelayNote) baseDelayNote.textContent = 'تأخیر بین درخواست‌های موفق هر بخش.';
            if (quotaDelayLabel) quotaDelayLabel.textContent = 'تأخیر سهمیه (ms):';
            const quotaDelayNote = quotaDelayLabel?.closest('.form-group')?.querySelector('.note');
            if(quotaDelayNote) quotaDelayNote.textContent = 'تأخیر پس از رسیدن به محدودیت (خطای 429).';
            if (chunkCountLabel) chunkCountLabel.textContent = 'تعداد بخش‌ها:';
            const chunkCountNote = chunkCountLabel?.closest('.form-group')?.querySelector('.note');
            if(chunkCountNote) chunkCountNote.textContent = 'تقسیم SRT به این تعداد بخش (1-100).';
            if (donateButton) {
                donateButton.textContent = 'حمایت مالی با رمزارز';
                 // Ensure it's visible (CSS might hide it initially if not)
                donateButton.style.display = 'inline-block'; // Or 'block' depending on your layout preference
            }
            const tempLabel = document.getElementById('temperature-label'); if (tempLabel) tempLabel.textContent = 'دما:';
            const tempNote = tempLabel?.closest('.form-group')?.querySelector('.note'); if(tempNote) tempNote.textContent = 'کنترل تصادفی بودن (0.0-2.0). مقادیر بالاتر = خلاقیت/تصادفی بیشتر.';
            const topPLabel = document.getElementById('top-p-label'); if (topPLabel) topPLabel.textContent = 'Top-P:';
            const topPNote = topPLabel?.closest('.form-group')?.querySelector('.note'); if(topPNote) topPNote.textContent = 'نمونه‌برداری هسته‌ای (0.0-1.0).';
            const topKLabel = document.getElementById('top-k-label'); if (topKLabel) topKLabel.textContent = 'Top-K:';
            const topKNote = topKLabel?.closest('.form-group')?.querySelector('.note'); if(topKNote) topKNote.textContent = 'نمونه‌برداری از K توکن محتمل‌تر (عدد صحیح >= 1).';
            const maxTokensLabel = document.getElementById('max-output-tokens-label'); if (maxTokensLabel) maxTokensLabel.textContent = 'حداکثر توکن خروجی:';
            const maxTokensNote = maxTokensLabel?.closest('.form-group')?.querySelector('.note'); if(maxTokensNote) maxTokensNote.textContent = 'حداکثر تعداد توکن برای تولید در هر درخواست.';
            const stopSeqLabel = document.getElementById('stop-sequences-label'); if (stopSeqLabel) stopSeqLabel.textContent = 'دنباله‌های توقف (جدا شده با کاما):';
            const stopSeqNote = stopSeqLabel?.closest('.form-group')?.querySelector('.note'); if(stopSeqNote) stopSeqNote.textContent = 'اگر این رشته‌ها ظاهر شوند، تولید متوقف شود. خالی بگذارید اگر نیازی نیست.';
            if (translationPromptLabel) translationPromptLabel.textContent = 'دستورالعمل سیستم / پرامپت:';
             const promptNote = translationPromptLabel?.closest('.form-group')?.querySelector('.note');
            if(promptNote) promptNote.textContent = 'دستورالعمل‌های داده شده به مدل هوش مصنوعی.';
            if (submitButtonText) submitButtonText.textContent = 'ترجمه';
            const submitHint = submitButton?.querySelector('.shortcut-hint');
            if (submitHint) submitHint.textContent = '(Ctrl+Enter)';
            if (apiKeyNote) apiKeyNote.innerHTML = "کلید API خود را از <a href='https://aistudio.google.com/app/apikey' target='_blank'>Google AI Studio</a> دریافت کنید.";

        } else { // English
            htmlElement.lang = 'en';
            // Hide Persian footer, show English
            if (footerPersian) footerPersian.style.display = 'none';
            if (footerEnglish) footerEnglish.style.display = 'block';

            if (pageTitle) pageTitle.textContent = 'Subtitle Translator';
            if (uploadInstructions) uploadInstructions.textContent = 'Upload an SRT, VTT, SSA, or ASS file or paste SRT content, provide your Gemini API key, and select the target language.';
            if (textPasteNote) textPasteNote.textContent = 'Note: Pasting text currently only supports the SRT format. For VTT/SSA/ASS, please use file upload.';
            if (warningMessage) warningMessage.textContent = '⚠️ If in Iran, enable "Use Proxy" in Settings for Gemini API access due to sanctions.';
             const advancedWarning = document.querySelector('.advanced-warning-message');
            if (advancedWarning) advancedWarning.textContent = '⚠️ Adjusting these settings can affect performance, cost, and translation quality. Proceed with caution.';
            if (inputMethodLabel) inputMethodLabel.textContent = 'Input Method:';
            const fileRadioLabel = document.querySelector('label.radio-label:has(input[value="file"])');
            if (fileRadioLabel) fileRadioLabel.lastChild.textContent = ' Upload File';
            const textRadioLabel = document.querySelector('label.radio-label:has(input[value="text"])');
            if (textRadioLabel) textRadioLabel.lastChild.textContent = ' Paste Text';
            if (fileLabel) fileLabel.textContent = 'Upload Subtitle File (SRT, VTT, SSA, ASS):';
            if (textLabel) textLabel.textContent = 'Paste SRT Content:';
            if (apiKeyLabel) apiKeyLabel.textContent = 'Gemini API Key:';
            if (apiKeyInput) apiKeyInput.placeholder = 'Enter your Gemini API key';
            if (rememberMeLabel) rememberMeLabel.textContent = 'Remember API key';
            if (langLabel) langLabel.textContent = 'Target Language:';
            if (langInput) langInput.placeholder = 'e.g., Spanish, French, Japanese';
            if (advancedSettingsSummaryText) advancedSettingsSummaryText.textContent = 'Advanced Settings';
            if (useProxyLabel) useProxyLabel.textContent = 'Use Proxy';
            const rememberMeNote = rememberMeLabel?.closest('.checkbox-group')?.querySelector('.note');
            if (rememberMeNote) rememberMeNote.textContent = '(uses Local Storage)';
             const useProxyNote = useProxyLabel?.closest('.checkbox-group')?.querySelector('.note');
            if (useProxyNote) useProxyNote.textContent = 'Enable if direct Gemini API access is blocked (e.g., sanctioned regions).';
            if (modelLabel) modelLabel.textContent = 'Gemini Model:';
            const modelNote = modelLabel?.closest('.form-group')?.querySelector('.note');
            if (modelNote) modelNote.textContent = 'Select the AI model for translation.';
            if (baseDelayLabel) baseDelayLabel.textContent = 'Base Delay (ms):';
             const baseDelayNote = baseDelayLabel?.closest('.form-group')?.querySelector('.note');
            if(baseDelayNote) baseDelayNote.textContent = 'Delay between successful chunk requests.';
            if (quotaDelayLabel) quotaDelayLabel.textContent = 'Quota Delay (ms):';
            const quotaDelayNote = quotaDelayLabel?.closest('.form-group')?.querySelector('.note');
            if(quotaDelayNote) quotaDelayNote.textContent = 'Delay after hitting a rate limit (429 error).';
            if (chunkCountLabel) chunkCountLabel.textContent = 'Number of Chunks:';
            const chunkCountNote = chunkCountLabel?.closest('.form-group')?.querySelector('.note');
            if(chunkCountNote) chunkCountNote.textContent = 'Split SRT into this many parts (1-100).';
            if (donateButton) {
                donateButton.textContent = 'Donate with Crypto';
                donateButton.style.display = 'inline-block'; // Or 'block'
            }
             const tempLabel = document.getElementById('temperature-label'); if (tempLabel) tempLabel.textContent = 'Temperature:';
             const tempNote = tempLabel?.closest('.form-group')?.querySelector('.note'); if(tempNote) tempNote.textContent = 'Controls randomness (0.0-2.0). Higher values = more creative/random.';
             const topPLabel = document.getElementById('top-p-label'); if (topPLabel) topPLabel.textContent = 'Top-P:';
             const topPNote = topPLabel?.closest('.form-group')?.querySelector('.note'); if(topPNote) topPNote.textContent = 'Nucleus sampling (0.0-1.0). Considers tokens comprising the top P probability mass.';
             const topKLabel = document.getElementById('top-k-label'); if (topKLabel) topKLabel.textContent = 'Top-K:';
             const topKNote = topKLabel?.closest('.form-group')?.querySelector('.note'); if(topKNote) topKNote.textContent = 'Sample from the K most likely tokens (integer >= 1).';
             const maxTokensLabel = document.getElementById('max-output-tokens-label'); if (maxTokensLabel) maxTokensLabel.textContent = 'Max Output Tokens:';
             const maxTokensNote = maxTokensLabel?.closest('.form-group')?.querySelector('.note'); if(maxTokensNote) maxTokensNote.textContent = 'Maximum number of tokens to generate per request (check model limits).';
             const stopSeqLabel = document.getElementById('stop-sequences-label'); if (stopSeqLabel) stopSeqLabel.textContent = 'Stop Sequences (comma-separated):';
             const stopSeqNote = stopSeqLabel?.closest('.form-group')?.querySelector('.note'); if(stopSeqNote) stopSeqNote.textContent = 'Stop generation if these strings appear. Leave blank if none.';
            if (translationPromptLabel) translationPromptLabel.textContent = 'System Prompt / Instructions:';
             const promptNote = translationPromptLabel?.closest('.form-group')?.querySelector('.note');
            if(promptNote) promptNote.textContent = 'Instructions given to the AI model.';
            if (submitButtonText) submitButtonText.textContent = 'Translate';
            const submitHint = submitButton?.querySelector('.shortcut-hint');
            if (submitHint) submitHint.textContent = '(Ctrl+Enter)';
            if (apiKeyNote) apiKeyNote.innerHTML = "Get your API key from <a href='https://aistudio.google.com/app/apikey' target='_blank'>Google AI Studio</a>.";
        }
        // Also update progress texts if they exist and are visible
        updateProgressTextsForLanguage(lang);

        localStorage.setItem('language', lang);
        console.log(`Language set to ${lang}, UI updated.`);
    } catch (e) {
        console.error("Error updating language UI:", e);
    }
}

// --- NEW Helper Function ---
function updateProgressTextsForLanguage(lang) {
    const isRTL = lang === 'Persian';
    const progressTextElem = document.getElementById('progress-text');
    const chunkStatusElem = document.getElementById('chunk-status');
    const timeEstimateElem = document.getElementById('time-estimate');

    // Update texts based on current progress values if elements exist
    // This assumes the numeric part (e.g., percentage, chunk numbers) is already correct
    if (progressTextElem) {
        const currentPercentage = progressTextElem.textContent.match(/\d+/)?.[0] || 0; // Extract number
        progressTextElem.textContent = isRTL ? `${currentPercentage}% تکمیل شده` : `${currentPercentage}% Complete`;
    }
    if (chunkStatusElem) {
        const match = chunkStatusElem.textContent.match(/(\d+)\/(\d+)/);
        const currentChunk = match?.[1] || 0;
        const totalChunks = match?.[2] || 0;
        chunkStatusElem.textContent = isRTL ? `پردازش بخش: ${currentChunk}/${totalChunks}` : `Processing chunk: ${currentChunk}/${totalChunks}`;
    }
    // Time estimate text is already handled within updateProgress based on language
}

// --- Utility Functions ---
function togglePasswordVisibility() {
    const icon = togglePasswordBtn?.querySelector('i');
    if (!icon || !apiKeyInput) return;
    if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        apiKeyInput.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

function saveApiKey() {
    if (!rememberMeCheckbox || !apiKeyInput) return;
    if (rememberMeCheckbox.checked && apiKeyInput.value) {
        try {
            localStorage.setItem('savedApiKey', apiKeyInput.value);
            console.log('API key saved.');
        } catch (e) {
            console.error("Failed to save API key to localStorage:", e);
            showError("Could not save API key. LocalStorage might be full or disabled.");
        }
    } else {
        localStorage.removeItem('savedApiKey');
        console.log('API key not saved or removed.');
    }
}

function loadApiKey() {
    if (!apiKeyInput || !rememberMeCheckbox) return;
    try {
        const savedApiKey = localStorage.getItem('savedApiKey');
        if (savedApiKey) {
            apiKeyInput.value = savedApiKey;
            rememberMeCheckbox.checked = true;
            console.log('API key loaded.');
        }
    } catch (e) {
         console.error("Failed to load API key from localStorage:", e);
    }
}

function showError(message, isSuccess = false) {
    if (!errorMessageDiv) return;
    if (!message) {
        hideError();
        return;
    }
    errorMessageDiv.textContent = message;
    errorMessageDiv.classList.toggle('success', isSuccess);
    errorMessageDiv.classList.add('visible');
}

function hideError() {
    if (!errorMessageDiv) return;
     errorMessageDiv.classList.remove('visible', 'success');
     errorMessageDiv.textContent = '';
}

function resetUI() {
    if (submitButton) submitButton.disabled = false;
    if (submitButtonText) submitButtonText.textContent = localStorage.getItem('language') === 'Persian' ? 'ترجمه' : 'Translate';
    if (progressContainer) progressContainer.style.display = 'none';
    if (progressBar) progressBar.style.width = '0%';
    if (progressText) progressText.textContent = '0% Complete';
    if (chunkStatusSpan) chunkStatusSpan.textContent = 'Processing chunk: 0/0';
    if (timeEstimateSpan) timeEstimateSpan.textContent = 'Estimated time: calculating...';
    if (downloadLinkContainer) downloadLinkContainer.style.display = 'none';
    if (downloadLinkContainer) downloadLinkContainer.innerHTML = '';
    hideError();

    // --- NEW: Clear retry state ---
    failedChunksData = [];
    currentAllTranslatedEntries = [];
    const retryContainer = document.getElementById('retry-container');
    if (retryContainer) retryContainer.remove(); // Remove the whole container
    // --- END NEW ---
}

function updateProgress(chunkIndex, totalChunks, startTime) { // Pass startTime *only* on the very first call (chunkIndex 0)
    if (!progressContainer || !progressBar || !progressText || !chunkStatusSpan || !timeEstimateSpan) {
       console.warn("Progress elements not found, cannot update progress UI.");
       return;
    }
    // Ensure progress container is visible when updates start
    if (progressContainer.style.display === 'none') {
       progressContainer.style.display = 'block';
    }

   const lang = localStorage.getItem('language') || 'English';
   const isRTL = lang === 'Persian';

   const currentDisplayChunk = chunkIndex + 1; // User-facing index (1-based)
   const progressPercentage = totalChunks > 0 ? Math.round((currentDisplayChunk / totalChunks) * 100) : 0;

   progressBar.style.width = `${progressPercentage}%`;
   // Update text based on percentage and language
   progressText.textContent = isRTL ? `${progressPercentage}% تکمیل شده` : `${progressPercentage}% Complete`;

   // Update chunk status number part
   chunkStatusSpan.textContent = isRTL ? `پردازش بخش: ${currentDisplayChunk}/${totalChunks}` : `Processing chunk: ${currentDisplayChunk}/${totalChunks}`;

   // --- Time Estimation Logic ---
   // Initial calculation state (only on the very first call)
   if (chunkIndex === 0 && startTime && totalChunks > 1) {
        timeEstimateSpan.textContent = isRTL ? 'زمان تخمینی: در حال محاسبه...' : 'Estimated time: calculating...';
        // firstChunkTime will be calculated *after* this first chunk finishes
   }
   // Use calculated firstChunkTime for subsequent chunks
   else if (firstChunkTime > 0 && chunkIndex > 0 && totalChunks > 1) {
       const remainingChunks = totalChunks - currentDisplayChunk; // Use user-facing index here
       if (remainingChunks >= 0) {
           const estimatedRemainingTime = remainingChunks * firstChunkTime; // In seconds
           const minutes = Math.floor(estimatedRemainingTime / 60);
           const seconds = Math.floor(estimatedRemainingTime % 60);
           timeEstimateSpan.textContent = isRTL
               ? `زمان تخمینی: ~${minutes}د ${seconds}ث باقیمانده`
               : `Estimated time: ~${minutes}m ${seconds}s remaining`;
       } else { // Should ideally not happen if logic is correct, but fallback
            timeEstimateSpan.textContent = isRTL ? 'زمان تخمینی: در حال نهایی‌سازی...' : 'Estimated time: finalizing...';
       }
   }
   // Handle case with only one chunk or when firstChunkTime isn't ready yet
   else if (totalChunks <= 1 || chunkIndex === 0) {
        timeEstimateSpan.textContent = isRTL ? 'زمان تخمینی: در حال پردازش...' : 'Estimated time: processing...';
   }
   // --- End Time Estimation Logic ---
}

// --- Translation Memory --- (Keep functions as they were, seem ok)
function updateTranslationMemory(sourceText, translatedText, lang) {
    if (!sourceText || !translatedText || typeof sourceText !== 'string' || typeof translatedText !== 'string') return;
    const trimmedSource = sourceText.trim();
    const trimmedTranslated = translatedText.trim();
    if (!trimmedSource || !trimmedTranslated) return;

    if (!translationMemory[lang]) {
        translationMemory[lang] = {};
    }
    translationMemory[lang][trimmedSource] = trimmedTranslated;

    try {
         localStorage.setItem('translationMemory', JSON.stringify(translationMemory));
    } catch (e) {
        console.error("Error saving translation memory:", e);
        showError("Warning: Could not save to translation memory (storage might be full).");
    }
}

function findInTranslationMemory(text, lang) {
     if (!text || typeof text !== 'string') return undefined;
     return translationMemory[lang]?.[text.trim()];
}

function clearTranslationMemory() {
    const confirmationText = localStorage.getItem('language') === 'Persian'
        ? 'آیا مطمئن هستید که می‌خواهید تمام ترجمه‌های ذخیره شده در حافظه را پاک کنید؟'
        : 'Are you sure you want to clear all saved translations from memory?';
    if (confirm(confirmationText)) {
        translationMemory = {};
        localStorage.removeItem('translationMemory');
        console.log('Translation memory cleared.');
        alert(localStorage.getItem('language') === 'Persian' ? 'حافظه ترجمه پاک شد!' : 'Translation memory cleared!');
    }
}


// --- SRT Parsing and Handling (Keep robust version) ---
function parseSubtitle(content, format) {
    console.log(`Parsing content as ${format.toUpperCase()} format.`);
    switch (format) {
        case 'vtt':
            return parseVTT(content);
        case 'ssa':
        case 'ass':
            return parseSSA_ASS(content);
        case 'srt':
        default:
            return parseSRTInternal(content); // Keep SRT logic separate
    }
}

// --- ADD NEW VTT Parser ---
// --- REVISED VTT Parser ---
function parseVTT(vttContent) {
    console.log(`Parsing VTT content (length: ${vttContent.length})`);
    const entries = [];
    let currentEntry = null;
    let lineBuffer = []; // Buffer for cue text lines
    let lastLineWasTimestamp = false;
    let lastLineWasIdentifier = false;
    let entryCount = 0;

    const lines = vttContent.replace(/^\uFEFF/, '').replace(/\r\n|\r/g, '\n').split('\n');

    // Add WEBVTT header if missing, otherwise just add the first line
    if (!lines[0].startsWith('WEBVTT')) {
        console.warn("VTT file does not start with WEBVTT header. Adding one.");
        entries.push({ otherData: { lineType: 'metadata', originalLine: 'WEBVTT' } });
        // Add a blank line after synthesized header if the first content line isn't blank
        if (lines.length > 0 && lines[0].trim() !== '') {
             entries.push({ otherData: { lineType: 'metadata', originalLine: '' } });
        }
    } else {
         entries.push({ otherData: { lineType: 'metadata', originalLine: lines[0] } });
    }


    for (let i = 1; i < lines.length; i++) {
        const line = lines[i]; // Keep original line with potential whitespace for reconstruction
        const trimmedLine = line.trim();

        const timeStampMatch = trimmedLine.match(/^(\d{2}:)?\d{2}:\d{2}[.,]\d{3}\s*-->\s*(\d{2}:)?\d{2}:\d{2}[.,]\d{3}(\s+.*)?$/);

        if (trimmedLine === '') { // Blank line
            if (currentEntry) {
                 // Finalize the previous cue entry
                 currentEntry.text = lineBuffer.join('\n');
                 entries.push(currentEntry);
                 currentEntry = null;
                 lineBuffer = [];
            }
             // Always add the blank line itself as metadata to preserve structure
             entries.push({ otherData: { lineType: 'metadata', originalLine: line } });
             lastLineWasTimestamp = false;
             lastLineWasIdentifier = false;
             continue; // Move to next line
        }

        if (timeStampMatch) {
            if (currentEntry) { // If we encounter a timestamp immediately after another without a blank line
                 console.warn("Found timestamp directly after another cue's text - finalizing previous cue.");
                 currentEntry.text = lineBuffer.join('\n');
                 entries.push(currentEntry);
                 lineBuffer = [];
            }

            entryCount++;
            const cueSettings = timeStampMatch[3] ? timeStampMatch[3].trim() : '';
            let identifier = null;

            // Check if the *previous* entry added was an identifier line
            if (lastLineWasIdentifier && entries.length > 0) {
                 const potentialIdEntry = entries[entries.length - 1];
                 // Make sure it wasn't a blank line or another timestamp
                 if (potentialIdEntry.otherData.lineType === 'metadata' && potentialIdEntry.otherData.originalLine.trim() !== '' && !potentialIdEntry.otherData.originalLine.includes('-->')) {
                    identifier = potentialIdEntry.otherData.originalLine.trim();
                     // We'll keep the identifier entry in the list for reconstruction order
                 } else {
                     lastLineWasIdentifier = false; // It wasn't a valid identifier line
                 }
            }

            // Create the main cue object - text will be added later
            currentEntry = {
                id: identifier || `auto_${entryCount}`, // Use found ID or generate
                timeStamp: trimmedLine.replace(/[.,]/g, ',').replace(/\s*-->\s*/, ' --> '), // Normalized timestamp (for potential future use)
                text: null, // Placeholder for text lines
                otherData: {
                    lineType: 'cue',
                    // Store the original timestamp line exactly as it was for reconstruction
                    originalTimestampLine: line,
                    cueSettings: cueSettings
                }
            };

            // Add the timestamp line itself as a metadata entry for reconstruction order
             entries.push({ otherData: { lineType: 'metadata_timestamp', originalLine: line } });

             lastLineWasTimestamp = true;
             lastLineWasIdentifier = false; // Reset identifier flag

        } else if (currentEntry) {
             // This line is part of the current cue's text
             lineBuffer.push(line);
             lastLineWasTimestamp = false;
             lastLineWasIdentifier = false;
        } else {
            // This line is metadata (NOTE, STYLE, Region, comment, potential identifier)
            // If the previous line was NOT a timestamp or blank, this *could* be an identifier
             const prevTrimmedLine = (i > 0) ? lines[i-1].trim() : '';
             if (trimmedLine !== '' && !lastLineWasTimestamp && prevTrimmedLine !== '' && !prevTrimmedLine.includes('-->') ) {
                 lastLineWasIdentifier = true;
             } else {
                 lastLineWasIdentifier = false;
             }
             entries.push({ otherData: { lineType: 'metadata', originalLine: line } });
             lastLineWasTimestamp = false; // Reset timestamp flag
        }
    }

    // Handle the very last cue if the file doesn't end with a blank line
    if (currentEntry) {
        currentEntry.text = lineBuffer.join('\n');
        entries.push(currentEntry);
    }

    console.log(`Parsed VTT. Total entries for reconstruction: ${entries.length}. Detected cues: ${entryCount}`);
    // Filter out the 'cue' objects for translation processing later, but return the full list for reconstruction
    return entries;
}

// --- ADD NEW SSA/ASS Parser (Simplified) ---
function parseSSA_ASS(ssaContent) {
    console.log(`Parsing SSA/ASS content (length: ${ssaContent.length})`);
    const entries = [];
    let inEventsSection = false;
    let formatFields = []; // To store the fields order from Format: line
    let dialogueCount = 0;

    const lines = ssaContent.replace(/^\uFEFF/, '').replace(/\r\n|\r/g, '\n').split('\n');

    for (const line of lines) {
        const trimmedLine = line.trim();

        if (trimmedLine.startsWith('[')) { // Section header
            inEventsSection = trimmedLine.toLowerCase() === '[events]';
             entries.push({ id: null, timeStamp: null, text: null, otherData: { originalLine: line, lineType: 'section' } });
            continue;
        }

        if (inEventsSection) {
            if (trimmedLine.toLowerCase().startsWith('format:')) {
                formatFields = trimmedLine.substring(7).split(',').map(f => f.trim().toLowerCase());
                 entries.push({ id: null, timeStamp: null, text: null, otherData: { originalLine: line, lineType: 'format' } });
            } else if (trimmedLine.toLowerCase().startsWith('dialogue:')) {
                dialogueCount++;
                const parts = trimmedLine.substring(9).split(',');
                const dialogueData = {};
                let textIndex = -1;

                // Map parts to formatFields
                for (let i = 0; i < formatFields.length; i++) {
                    const fieldName = formatFields[i];
                     // The 'Text' field might contain commas, so join remaining parts
                    if (fieldName === 'text') {
                        textIndex = i;
                        dialogueData[fieldName] = parts.slice(i).join(',');
                        break; // Text is the last field specified by Format
                    }
                    dialogueData[fieldName] = parts[i] || ''; // Handle missing values
                }

                if (textIndex === -1) { // Text field not found in Format line?
                    console.warn(`Could not find 'Text' field in Dialogue line: ${trimmedLine}`);
                     entries.push({ id: `error_${dialogueCount}`, timeStamp: null, text: null, otherData: { originalLine: line, lineType: 'malformed_dialogue' } });
                     continue;
                }

                 const startTime = dialogueData['start'] || '0:00:00.00';
                 const endTime = dialogueData['end'] || '0:00:00.00';
                 const timestamp = `${startTime} --> ${endTime}`; // Create a pseudo-timestamp

                entries.push({
                    id: `D${dialogueCount}`, // Generate an ID
                    timeStamp: timestamp,
                    text: dialogueData['text'] || '',
                    otherData: {
                        originalLine: line,
                        lineType: 'dialogue', // Specific type
                        fields: dialogueData, // Store all parsed fields
                        formatOrder: formatFields // Store the order
                    }
                });
            } else if (trimmedLine.toLowerCase().startsWith('comment:')) {
                 entries.push({ id: null, timeStamp: null, text: null, otherData: { originalLine: line, lineType: 'comment' } });
            } else {
                // Other lines within [Events] (could be Picture, Sound, Movie, etc.) - treat as comment for now
                 entries.push({ id: null, timeStamp: null, text: null, otherData: { originalLine: line, lineType: 'other_event' } });
            }
        } else {
            // Lines outside [Events] (e.g., [Script Info], [Styles], etc.)
            entries.push({ id: null, timeStamp: null, text: null, otherData: { originalLine: line, lineType: 'metadata' } });
        }
    }

    console.log(`Parsed ${dialogueCount} SSA/ASS dialogue lines.`);
    return entries;
}

// --- Internal SRT Parser (Original logic, now renamed) ---
function parseSRTInternal(srtContent) {
    console.log(`Parsing SRT content (length: ${srtContent.length})`);
    let normalizedContent = srtContent.replace(/^\uFEFF/, '').replace(/\r\n|\r/g, '\n');
    const blocks = normalizedContent.split(/\n\s*\n/);
    const parsedEntries = [];
    let entryCount = 0;
    let skippedBlocks = 0;

    for (const block of blocks) {
        const trimmedBlock = block.trim();
        if (!trimmedBlock) continue;
        const lines = trimmedBlock.split('\n');
        if (lines.length < 2) {
            console.warn(`Skipping malformed SRT block (< 2 lines): "${trimmedBlock.substring(0, 50)}..."`);
            skippedBlocks++; continue;
        }
        let idLine = lines[0].trim();
        let timeLine = lines[1].trim();
        let text = lines.slice(2).join('\n');
        const timestampRegex = /^\d{1,2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[,.]\d{3}$/;
        let currentIdNum = -1;
        if (/^\d+$/.test(idLine)) {
            currentIdNum = parseInt(idLine, 10); entryCount = Math.max(entryCount, currentIdNum);
        } else {
            if (timestampRegex.test(idLine)) {
                 console.warn(`Fixing SRT block with timestamp on first line: "${idLine.substring(0,20)}..."`);
                 text = timeLine + (text ? '\n' + text : ''); timeLine = idLine; entryCount++;
                 idLine = entryCount.toString(); currentIdNum = entryCount;
            } else {
                console.warn(`Assigning sequential ID to SRT block with non-numeric ID: "${idLine.substring(0,20)}..."`);
                entryCount++; idLine = entryCount.toString(); currentIdNum = entryCount;
            }
        }
        if (!timestampRegex.test(timeLine)) {
             console.warn(`Skipping SRT block ID "${idLine}" due to invalid timestamp: "${timeLine.substring(0,50)}..."`);
             skippedBlocks++; continue;
        }
        timeLine = timeLine.replace(/\./g, ',').replace(/\s*-->\s*/, ' --> ');
        parsedEntries.push({
             id: idLine,
             timeStamp: timeLine,
             text: text,
             otherData: { lineType: 'cue' } // Add consistent otherData
        });
    }
    console.log(`Parsed ${parsedEntries.length} SRT entries. Skipped ${skippedBlocks}.`);
    if (skippedBlocks > 0) showError(`Parsed ${parsedEntries.length} SRT entries, skipped ${skippedBlocks} malformed blocks.`, false);
    return parsedEntries;
}

// --- ADD NEW Generic Reconstructor ---
function reconstructSubtitle(entries, format) {
    console.log(`Reconstructing content as ${format.toUpperCase()} format.`);
    switch (format) {
        case 'vtt':
            return reconstructVTT(entries);
        case 'ssa':
        case 'ass':
            return reconstructSSA_ASS(entries);
        case 'srt':
        default:
            return reconstructSRTInternal(entries); // Use internal SRT logic
    }
}

// --- ADD NEW VTT Reconstructor ---
// --- REVISED VTT Reconstructor ---
function reconstructVTT(entries) {
    const outputLines = [];
    let cueCount = 0; // Count reconstructed cues

    entries.forEach(entry => {
        const lineType = entry.otherData?.lineType;

        if (lineType === 'cue') {
            // The 'cue' entry itself now only holds the text data.
            // The identifier (if any) and timestamp were added separately as 'metadata'.
            outputLines.push(entry.text || ''); // Add the (potentially translated) text
            cueCount++;
        } else if (lineType === 'metadata' || lineType === 'metadata_timestamp') {
            // Add back all non-cue lines (headers, comments, styles, blank lines, cue IDs, timestamps)
            // using their original stored line content.
            outputLines.push(entry.otherData.originalLine);
        } else {
            // Fallback for unexpected types
            console.warn("Unexpected entry type during VTT reconstruction:", entry);
            // Attempt to reconstruct something sensible
            if (entry.text !== null && entry.text !== undefined) {
                 outputLines.push(entry.text);
            } else if (entry.otherData?.originalLine !== undefined) {
                 outputLines.push(entry.otherData.originalLine);
            }
        }
    });

    console.log(`Reconstructed ${cueCount} VTT cues.`);
    // Join lines, ensuring consistent line endings. Add one trailing newline for safety.
    let result = outputLines.join('\n');
    // Ensure file ends with exactly one newline if it's not empty
    if (result.length > 0 && !result.endsWith('\n')) {
        result += '\n';
    }
    // VTT technically doesn't require the double newline like SRT
    return result;
}

// --- ADD NEW SSA/ASS Reconstructor ---
function reconstructSSA_ASS(entries) {
    const outputLines = [];
    let dialogueCount = 0;

    entries.forEach(entry => {
        const lineType = entry.otherData?.lineType;

        if (lineType === 'dialogue') {
            const fields = entry.otherData.fields || {};
            const formatOrder = entry.otherData.formatOrder || [];

            // Update the text field with the translated text
            fields['text'] = entry.text || '';

            // Reconstruct the line based on the original format order
            const reconstructedParts = formatOrder.map(fieldName => fields[fieldName] || '');
            outputLines.push(`Dialogue: ${reconstructedParts.join(',')}`);
            dialogueCount++;
        } else if (entry.otherData?.originalLine !== undefined) {
            // For all other line types (section, format, comment, metadata, etc.),
            // just push the original line back.
            outputLines.push(entry.otherData.originalLine);
        } else {
             console.warn("Unexpected entry during SSA/ASS reconstruction:", entry);
        }
    });

    console.log(`Reconstructed ${dialogueCount} SSA/ASS dialogue lines.`);
    // Join with newline, no extra trailing newlines needed usually for SSA/ASS
    return outputLines.join('\n');
}

// --- Internal SRT Reconstructor (Original logic, now renamed) ---
function reconstructSRTInternal(entries) {
    if (!Array.isArray(entries)) return '';
    // Filter only actual cue entries for SRT reconstruction
    const cueEntries = entries.filter(e => e.id && e.timeStamp && e.otherData?.lineType === 'cue');
    const sortedEntries = cueEntries.sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));
    const srtString = sortedEntries.map(entry => `${entry.id}\n${entry.timeStamp}\n${entry.text}`).join('\n\n');
    return srtString + '\n\n';
}

// --- ADD NEW Helper function to get MIME type ---
function getMimeType(format) {
    switch (format) {
        case 'srt':
            return 'text/srt'; // Or application/x-subrip
        case 'vtt':
            return 'text/vtt';
        case 'ssa':
        case 'ass':
            return 'text/plain'; // No standard MIME type, text/plain is safe
        default:
            return 'text/plain';
    }
}

function splitIntoChunks(array, chunkCount) {
    if (!Array.isArray(array) || array.length === 0) return [];
    const numChunks = Math.max(1, Math.floor(chunkCount) || 1);
    const effectiveChunkCount = Math.min(numChunks, array.length);
    const chunks = [];
    const baseChunkSize = Math.floor(array.length / effectiveChunkCount);
    let remainder = array.length % effectiveChunkCount;
    let startIndex = 0;
    console.log(`Splitting ${array.length} entries into ${effectiveChunkCount} chunks.`);
    for (let i = 0; i < effectiveChunkCount; i++) {
        const currentChunkSize = baseChunkSize + (remainder > 0 ? 1 : 0);
        chunks.push(array.slice(startIndex, startIndex + currentChunkSize));
        startIndex += currentChunkSize;
        if (remainder > 0) remainder--;
    }
    return chunks;
}


// --- API Interaction (Corrected Proxy Logic, Gen Params, and Retry Call Safety) ---
async function translateChunk(
    chunk, apiKey, baseDelayMs, quotaDelayMs, lang,
    chunkIndex, // User-facing index (1-based)
    totalChunksForLog, // Total chunks for logging (can be 0/null during retry)
    model, promptTemplate,
    temperature, topP, topK, maxOutputTokens, stopSequencesStr
) {
    // Input validation at the start
    if (!chunk || chunk.length === 0) {
        console.warn(`TranslateChunk called with empty chunk (Index: ${chunkIndex})`);
        return []; // Return empty array for empty chunk
    }
    if (!apiKey || !model || !lang) {
        throw new Error(`TranslateChunk called with missing required parameters (apiKey, model, lang) for chunk ${chunkIndex}`);
    }

    // --- Update Progress / Log Start (Conditional on totalChunksForLog) ---
    // Only update main progress bar if called from initial translation loop
    if (totalChunksForLog && totalChunksForLog > 0) {
        // Note: updateProgress uses 0-based index internally, but we receive 1-based chunkIndex
         updateProgress(chunkIndex - 1, totalChunksForLog, chunkIndex === 1 ? performance.now() : null);
    }
    console.log(`Starting Chunk ${chunkIndex}${totalChunksForLog ? `/${totalChunksForLog}` : ''} (${chunk.length} entries)`);
    // --- End Progress Update ---


    const sourceTexts = chunk.map(entry => entry.text);
    const cachedTranslations = sourceTexts.map(text => findInTranslationMemory(text, lang));
    const textsToTranslateMap = new Map();
    let cacheHitCount = 0;

    sourceTexts.forEach((text, index) => {
        if (cachedTranslations[index] === undefined) {
            if (text?.trim()) { textsToTranslateMap.set(index, text); }
             else { cachedTranslations[index] = ''; }
        } else { cacheHitCount++; }
    });

    if (textsToTranslateMap.size === 0) {
        console.log(`Chunk ${chunkIndex}: All ${chunk.length} entries cached or empty.`);
        await new Promise(resolve => setTimeout(resolve, 50));
        return cachedTranslations;
    }

    if (cacheHitCount > 0) console.log(`Chunk ${chunkIndex}: ${cacheHitCount} from memory. Translating ${textsToTranslateMap.size}.`);

    const separator = "\n---\n";
    const indicesToTranslate = Array.from(textsToTranslateMap.keys());
    const combinedText = indicesToTranslate.map(index => textsToTranslateMap.get(index)).join(separator);
    const effectivePrompt = `${promptTemplate}\n\nTranslate the following text into ${lang}. Respond ONLY with the translated text lines, separated by "${separator.trim()}", maintaining the original number of separated lines.\n\nInput Text:\n${combinedText}`;

    const directUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const useProxy = useProxyCheckbox.checked; // Check current state
    let targetUrl;

    const generationConfig = { temperature, topP, topK, maxOutputTokens };
    const stopSequencesArray = stopSequencesStr.split(',').map(s => s.trim()).filter(s => s !== '');
    if (stopSequencesArray.length > 0) { generationConfig.stopSequences = stopSequencesArray; }

    let finalPayload = {
         contents: [{ parts: [{ text: effectivePrompt }] }],
         safetySettings: [
             { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
             { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
         ],
         generationConfig: generationConfig
     };

    if (useProxy) {
        targetUrl = proxyUrl;
        finalPayload.endpoint = directUrl;
        console.log(`Chunk ${chunkIndex}: Using Proxy (${targetUrl}). Sending endpoint in payload.`);
    } else {
        targetUrl = directUrl;
        console.log(`Chunk ${chunkIndex}: Using Direct URL (${targetUrl}).`);
    }

    const headers = { 'Content-Type': 'application/json' };
    const fetchOptions = { method: 'POST', headers: headers, body: JSON.stringify(finalPayload) };

    let attempts = 0;
    const maxAttempts = 4;

    while (attempts < maxAttempts) {
        try {
            if (attempts > 0) {
                 const retryDelay = Math.min(baseDelayMs * Math.pow(2, attempts -1), 15000);
                 console.log(`Chunk ${chunkIndex}: Retrying attempt ${attempts + 1} after ${retryDelay / 1000}s delay...`);
                 await new Promise(resolve => setTimeout(resolve, retryDelay));
            }

            const response = await fetch(targetUrl, fetchOptions);

            if (!response.ok) {
                let errorBodyText = ''; try { errorBodyText = await response.text(); } catch (e) {}
                console.error(`API Error (Chunk ${chunkIndex}, Attempt ${attempts + 1}): ${response.status} ${response.statusText}`, errorBodyText.substring(0, 300));
                if (response.status === 429) {
                    console.warn(`Chunk ${chunkIndex}: Quota exceeded (429). Waiting ${quotaDelayMs / 1000}s...`);
                    await new Promise(resolve => setTimeout(resolve, quotaDelayMs));
                    continue; // No attempt increment for quota
                } else if (response.status >= 500) {
                     console.warn(`Chunk ${chunkIndex}: Server error (${response.status}). Retrying...`); attempts++; continue;
                } else if (response.status === 400) {
                     if (errorBodyText.toLowerCase().includes("invalid argument")) {
                         throw new Error(`API Bad Request (400) - Invalid Argument. Check generation parameters. ${errorBodyText.substring(0,100)}`);
                     } else {
                         throw new Error(`API Bad Request (400). Check Key/Prompt/Model access. ${errorBodyText.substring(0,100)}`);
                     }
                } else { // Other client errors (401, 403, etc.)
                     attempts++; if (attempts >= maxAttempts) throw new Error(`API error ${response.status} after ${maxAttempts} attempts.`);
                     console.warn(`Chunk ${chunkIndex}: API error ${response.status}. Retrying...`); continue;
                }
            }

            // --- Process successful response ---
            const data = await response.json();
            const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            const finishReason = data?.candidates?.[0]?.finishReason;

            if (finishReason === "MAX_TOKENS") {
                console.warn(`Chunk ${chunkIndex}: Finished due to MAX_TOKENS limit. Output might be truncated.`);
                // Show non-blocking warning to user *only* if called from main loop
                if (totalChunksForLog && totalChunksForLog > 0) {
                     showError(`Warning: Chunk ${chunkIndex} output may be truncated due to token limit (${maxOutputTokens}).`, false);
                }
            }

            if (responseText === undefined || responseText === null) {
                 console.error(`Invalid API response structure (Chunk ${chunkIndex}): Finish Reason: ${finishReason}`, JSON.stringify(data).substring(0, 300));
                 if (finishReason && finishReason !== "STOP" && finishReason !== "MAX_TOKENS") {
                      throw new Error(`API Error: No text returned. Finish reason: ${finishReason}.`);
                 }
                 if (combinedText.trim() !== "") {
                      throw new Error('Invalid API response: No text found, but input was not empty.');
                 }
                 // Allow empty response if input was empty/whitespace
            }

            const rawTranslatedText = (responseText || "").trim();
            const translatedLines = rawTranslatedText.split(separator.trim()).map(line => line.trim());

            if (rawTranslatedText !== "" && translatedLines.length !== textsToTranslateMap.size) {
                 console.error(`Chunk ${chunkIndex}: Mismatch! Expected ${textsToTranslateMap.size} lines, Got ${translatedLines.length}.`);
                 console.error("Received response sample:", rawTranslatedText.substring(0, 200) + "...");
                 if (attempts < maxAttempts -1) {
                     attempts++; console.warn(`Retrying chunk ${chunkIndex} due to line mismatch...`);
                     await new Promise(resolve => setTimeout(resolve, baseDelayMs * 1.5)); continue;
                 } else { throw new Error(`Response lines (${translatedLines.length}) != input lines (${textsToTranslateMap.size}) after retries.`); }
             }

            const finalChunkTranslations = [...cachedTranslations];
             translatedLines.forEach((translatedText, i) => {
                 const originalIndex = indicesToTranslate[i];
                 const sourceText = sourceTexts[originalIndex];
                 finalChunkTranslations[originalIndex] = translatedText;
                 updateTranslationMemory(sourceText, translatedText, lang);
             });

            console.log(`Chunk ${chunkIndex} translated successfully.`);
            await new Promise(resolve => setTimeout(resolve, baseDelayMs)); // Base delay after success
            return finalChunkTranslations;

        } catch (error) {
            console.error(`Error in translateChunk ${chunkIndex} (Attempt ${attempts + 1}):`, error);
            attempts++;
            if (attempts >= maxAttempts) throw new Error(`Failed chunk ${chunkIndex} after ${maxAttempts} attempts: ${error.message}`);
            // Loop will apply backoff delay before next attempt
        }
    }
     // Fallback throw if loop somehow exits without returning/throwing earlier
     throw new Error(`Failed chunk ${chunkIndex} unexpectedly.`);
}


// --- Main Translation Orchestration ---
async function handleTranslate(event) {
    event.preventDefault();
    resetUI(); // Clear previous results/errors first

    // --- Input Validation ---
    const apiKey = apiKeyInput?.value.trim();
    const lang = langInput?.value.trim();
    const baseDelay = parseInt(baseDelayInput?.value, 10);
    const quotaDelay = parseInt(quotaDelayInput?.value, 10);
    let chunkCount = parseInt(chunkCountInput?.value, 10);
    const model = modelSelect?.value;
    const promptTemplate = translationPromptTextarea?.value.trim();
    const inputMethodRadio = document.querySelector('input[name="input_method"]:checked');
    const inputMethod = inputMethodRadio ? inputMethodRadio.value : 'file';
    const srtTextContent = srtTextInput?.value.trim(); // Note: Text input is still assumed SRT
    const temperature = parseFloat(temperatureInput?.value);
    const topP = parseFloat(topPInput?.value);
    const topK = parseInt(topKInput?.value, 10);
    const maxOutputTokens = parseInt(maxOutputTokensInput?.value, 10);
    const stopSequencesStr = stopSequencesInput?.value.trim() ?? '';

    let hasError = false;
    if (!apiKeyInput || !apiKey) { showError('Gemini API Key is required.'); hasError = true; }
    if (!langInput || !lang) { showError('Target Language is required.'); hasError = true; }
    if (!baseDelayInput || isNaN(baseDelay) || baseDelay < 100) { showError('Base Delay must be >= 100ms.'); hasError = true; }
    if (!quotaDelayInput || isNaN(quotaDelay) || quotaDelay < 1000) { showError('Quota Delay must be >= 1000ms.'); hasError = true; }
    if (!chunkCountInput || isNaN(chunkCount) || chunkCount < 1 || chunkCount > 100) { showError('Chunks must be between 1 and 100.'); hasError = true; }
    if (!modelSelect || !model) { showError('Please select a Gemini Model.'); hasError = true; }
    if (!temperatureInput || isNaN(temperature) || temperature < 0 || temperature > 2) { showError('Temperature must be a number between 0.0 and 2.0.'); hasError = true; }
    if (!topPInput || isNaN(topP) || topP < 0 || topP > 1) { showError('Top-P must be a number between 0.0 and 1.0.'); hasError = true; }
    if (!topKInput || isNaN(topK) || topK < 1) { showError('Top-K must be an integer >= 1.'); hasError = true; }
    if (!maxOutputTokensInput || isNaN(maxOutputTokens) || maxOutputTokens < 1) { showError('Max Output Tokens must be an integer >= 1.'); hasError = true; }
    if (hasError) return;

    let subtitleContent = '';
    let originalFileName = 'translation';

    if (inputMethod === 'file') {
        if (!uploadedFile) return showError('Please select or drop a subtitle file.');
        // currentOriginalFormat is set by Dropzone 'addedfile' event
        try {
            subtitleContent = await uploadedFile.text();
            // Remove extension for base name
            originalFileName = uploadedFile.name.replace(/\.(srt|vtt|ssa|ass)$/i, '');
            console.log(`Reading file: ${uploadedFile.name} (Format: ${currentOriginalFormat})`);
        } catch (readError) { console.error("Error reading file:", readError); return showError('Could not read the selected file.'); }
    } else { // inputMethod === 'text'
        if (!srtTextInput || !srtTextContent) return showError('Please paste SRT content.');
        // Assume SRT for pasted text
        currentOriginalFormat = 'srt'; // Force SRT for text paste for now
        subtitleContent = srtTextContent;
        console.log(`Using pasted content (assuming ${currentOriginalFormat.toUpperCase()} format).`);
    }
    if (!subtitleContent.trim()) return showError('Subtitle content is empty.');

    // --- Start Processing ---
    if (submitButton) submitButton.disabled = true;
    if (submitButtonText) submitButtonText.textContent = 'Translating...'; // Will be updated by language toggle if needed
    console.log('Starting translation process...');
    const startTime = performance.now();
    firstChunkTime = 0; // Reset timer
    failedChunksData = [];
    currentAllTranslatedEntries = [];

    // Store current settings needed for potential retries
    currentOriginalFileName = originalFileName; // Already set above
    // currentOriginalFormat is already set globally
    currentLang = lang; // Store current language being translated TO
    currentApiKey = apiKey;
    currentBaseDelay = baseDelay;
    currentQuotaDelay = quotaDelay;
    currentModel = model;
    currentPromptTemplate = promptTemplate;
    currentTemperature = temperature;
    currentTopP = topP;
    currentTopK = topK;
    currentMaxOutputTokens = maxOutputTokens;
    currentStopSequencesStr = stopSequencesStr;

    try {
        // --- Use generic parser ---
        const allParsedEntries = parseSubtitle(subtitleContent, currentOriginalFormat);
        if (allParsedEntries.length === 0) throw new Error('No valid entries found in the subtitle file. Cannot proceed.');

        // --- Filter entries that are cues AND have non-empty text ---
        const translatableEntries = allParsedEntries.filter(entry =>
            // Check if it's a type we want to translate
            (entry.otherData?.lineType === 'cue' || entry.otherData?.lineType === 'dialogue') &&
            // And if it has non-empty text
            entry.text !== null &&
            entry.text.trim() !== ''
        );

        if (translatableEntries.length === 0) {
             console.warn("No translatable text found in the file.");
             // Still generate the output file with original structure
             currentAllTranslatedEntries = [...allParsedEntries];
             generateAndDisplayDownloadLink();
             showError("No text found to translate in the file. Original structure preserved.", true);
             saveApiKey(); // Save API key even if nothing was translated
             return; // Exit early
        }

        chunkCount = Math.min(chunkCount, translatableEntries.length); // Chunk based on translatable entries
        const chunks = splitIntoChunks(translatableEntries, chunkCount); // Chunk only translatable ones
        if (chunks.length === 0) throw new Error('Failed to split subtitle into chunks.');
        const totalChunks = chunks.length;

        // --- Process chunks and merge back ---
        const translatedTextMap = new Map(); // Store translated text by original entry reference or ID
        const failedChunkIndices = [];

        // Initial progress update before loop starts
        updateProgress(-1, totalChunks, startTime); // Show 0% and calculate state

        for (let i = 0; i < totalChunks; i++) {
            const currentChunk = chunks[i]; // This chunk contains only translatable entries
             if (!currentChunk || currentChunk.length === 0) {
                 console.warn(`Chunk ${i+1} is empty or invalid, skipping.`);
                 continue;
             }

            // Update progress for the chunk *about* to be processed
            // Pass startTime only for the very first chunk (i === 0)
            updateProgress(i, totalChunks, i === 0 ? startTime : null);

            try {
                const chunkStartTime = performance.now(); // Timing specific to this chunk call

                // TranslateChunk expects array of { id, timeStamp, text, otherData }
                const translatedChunkTexts = await translateChunk(
                    currentChunk, // Pass the chunk of translatable entries
                    currentApiKey, currentBaseDelay, currentQuotaDelay, currentLang,
                    i + 1, // User-facing chunk index (1-based)
                    totalChunks, // Total chunks for progress display
                    currentModel, currentPromptTemplate,
                    currentTemperature, currentTopP, currentTopK, currentMaxOutputTokens, currentStopSequencesStr
                );

                 // ---- Timing END and Calculation ----
                 const chunkEndTime = performance.now();
                 const chunkDuration = (chunkEndTime - chunkStartTime) / 1000;
                 console.log(`Chunk ${i+1} processed in ${chunkDuration.toFixed(2)}s`);

                 if (i === 0 && totalChunks > 1) { // Calculate after first chunk if multiple chunks
                     firstChunkTime = chunkDuration; // Use the actual duration
                     console.log(`First chunk time set: ${firstChunkTime.toFixed(2)}s`);
                     // Update progress *again* to show the first time estimate
                     updateProgress(i, totalChunks, null);
                 }
                 // ---- END Timing ----


                // Store the results mapped to the original entry object
                 currentChunk.forEach((originalEntry, indexInChunk) => {
                      const translatedText = translatedChunkTexts && indexInChunk < translatedChunkTexts.length
                                              ? translatedChunkTexts[indexInChunk]
                                              : originalEntry.text; // Fallback to original if translation missing
                      // Use originalEntry object itself as map key
                      translatedTextMap.set(originalEntry, translatedText ?? originalEntry.text);
                 });

            } catch (chunkError) {
                console.error(`Caught error for chunk ${i + 1}:`, chunkError);
                const chunkIndexUserFacing = i + 1;
                failedChunkIndices.push(chunkIndexUserFacing);
                // Store original chunk data for retry
                failedChunksData.push({ index: i, chunkData: currentChunk, reason: chunkError.message || 'Unknown error' });
                showError(`ERROR on Chunk ${chunkIndexUserFacing}: ${chunkError.message}. Original text used for this chunk (Retry option available).`, false);
                // Mark these entries in the map with their original text
                currentChunk.forEach(originalEntry => {
                    translatedTextMap.set(originalEntry, originalEntry.text);
                });
            }
        } // End chunk loop


        // Merge translated text back into the *full* original parsed structure
        currentAllTranslatedEntries = allParsedEntries.map(entry => {
            if (translatedTextMap.has(entry)) {
                 // This entry was translated (or failed and kept original text)
                 return { ...entry, text: translatedTextMap.get(entry) };
            } else {
                // This entry was not translatable (e.g., metadata, comment)
                 return entry;
            }
        });


        // Reconstruct and Provide Initial Download Link
        generateAndDisplayDownloadLink(); // Uses currentAllTranslatedEntries and currentOriginalFormat

        // Final Status Message & Display Retry Buttons
        const endTime = performance.now();
        const duration = ((endTime - startTime) / 1000).toFixed(1);
        console.log(`Translation finished in ${duration} seconds.`);

        displayRetryButtons(); // Display retry buttons if needed

        // Get current interface language for messages
        const interfaceLang = localStorage.getItem('language') || 'English';
        const isRTL = interfaceLang === 'Persian';

        if (failedChunkIndices.length > 0) {
             const errorMsg = isRTL
                ? `ترجمه در ${duration} ثانیه با ${failedChunkIndices.length} بخش ناموفق کامل شد: [${failedChunkIndices.join(', ')}]. دکمه تلاش مجدد موجود است.`
                : `Complete in ${duration}s with ${failedChunkIndices.length} failed chunk(s): [${failedChunkIndices.join(', ')}]. Retry options available below.`;
             showError(errorMsg, false);
             if (timeEstimateSpan) timeEstimateSpan.textContent = isRTL ? `پایان با ${failedChunkIndices.length} خطا` : `Finished with ${failedChunkIndices.length} errors`;
        } else {
             const successMsg = isRTL ? `ترجمه موفقیت آمیز بود! (${duration} ثانیه)` : `Translation successful! (${duration}s)`;
             showError(successMsg, true);
             if (timeEstimateSpan) timeEstimateSpan.textContent = isRTL ? "پایان موفقیت آمیز" : "Finished successfully";
        }

        saveApiKey();

    } catch (error) {
        console.error('Main translation handler error:', error); // Log the specific error
        showError(`An critical error occurred: ${error.message}`);
        if (progressContainer) progressContainer.style.display = 'none';
    } finally {
        if (submitButton) submitButton.disabled = false;
        // Update button text based on interface language AFTER process finishes
        const finalButtonLang = localStorage.getItem('language') || 'English';
        if (submitButtonText) submitButtonText.textContent = finalButtonLang === 'Persian' ? 'ترجمه' : 'Translate';
    }
} // End handleTranslate

// --- NEW Functions for Retry Mechanism ---
function generateAndDisplayDownloadLink() {
    if (!downloadLinkContainer || !currentAllTranslatedEntries) return;

    try {
        // --- MODIFIED: Use generic reconstructor and format ---
        // Sorting might be complex for VTT/SSA if metadata order matters.
        // Reconstruction functions should handle the order based on the parsed entries.
        // const sortedEntries = [...currentAllTranslatedEntries]... // Sorting might break non-SRT formats
        const finalContent = reconstructSubtitle(currentAllTranslatedEntries, currentOriginalFormat);

        const mimeType = getMimeType(currentOriginalFormat);
        const blob = new Blob([`\uFEFF${finalContent}`], { type: `${mimeType};charset=utf-8` });
        const url = URL.createObjectURL(blob);
        // Use the correct original format extension
        const downloadFileName = `${currentOriginalFileName}_${currentLang}.${currentOriginalFormat}`;

        const interfaceLang = localStorage.getItem('language') || 'English';
        // --- MODIFIED: Indicate file type ---
        const mainText = interfaceLang === 'Persian'
            ? `دانلود فایل ${currentOriginalFormat.toUpperCase()}`
            : `Download ${currentOriginalFormat.toUpperCase()} File`;
        const langText = `(${currentLang})`;
         // --- END MODIFICATION ---

        downloadLinkContainer.innerHTML = `<a href="${url}" download="${downloadFileName}">${mainText}<br>${langText}</a>`;
        downloadLinkContainer.style.display = 'block';
        console.log(`Download link generated/updated: ${downloadFileName}`);

    } catch (error) {
        console.error("Error generating download link:", error);
        showError("Could not generate the download file.", false);
        if (downloadLinkContainer) downloadLinkContainer.style.display = 'none';
    }
}

function displayRetryButtons() {
    if (!failedChunksData || failedChunksData.length === 0) {
         const existingRetryContainer = document.getElementById('retry-container');
         if (existingRetryContainer) existingRetryContainer.remove();
        return;
    }

    let retryContainer = document.getElementById('retry-container');
    if (!retryContainer) {
        retryContainer = document.createElement('div');
        retryContainer.id = 'retry-container';
        retryContainer.classList.add('retry-container');
        // Ensure retry container appears consistently
        const targetElement = downloadLinkContainer || progressContainer || errorMessageDiv || submitButton.closest('.submit-container');
        targetElement?.insertAdjacentElement('afterend', retryContainer);
    }

    retryContainer.innerHTML = ''; // Clear previous buttons

    const title = document.createElement('p');
    title.classList.add('retry-title');
    title.textContent = localStorage.getItem('language') === 'Persian' ? 'تلاش مجدد برای بخش‌های ناموفق:' : 'Retry Failed Chunks:';
    retryContainer.appendChild(title);

    // Sort failed chunks by index for consistent button order
    failedChunksData.sort((a, b) => a.index - b.index).forEach(failedChunk => {
        const button = document.createElement('button');
        button.classList.add('button', 'secondary-button', 'retry-button');
        button.dataset.chunkIndex = failedChunk.index;

        const userFacingIndex = failedChunk.index + 1;
        // Simplified button text
        button.textContent = localStorage.getItem('language') === 'Persian'
            ? `تلاش مجدد بخش ${userFacingIndex}`
            : `Retry Chunk ${userFacingIndex}`;
        button.title = `Click to retry chunk ${userFacingIndex}`; // Tooltip still shows index

        button.addEventListener('click', handleManualRetry);
        retryContainer.appendChild(button);
    });
}

async function handleManualRetry(event) {
    const button = event.target.closest('.retry-button');
    if (!button || button.disabled) return;

    const internalChunkIndex = parseInt(button.dataset.chunkIndex, 10);
    const failedChunkInfo = failedChunksData.find(fc => fc.index === internalChunkIndex);

    if (!failedChunkInfo) {
        console.error("Could not find failed chunk data for index:", internalChunkIndex);
        showError("Error: Could not find data for this chunk retry.", false);
        return;
    }

    const userFacingIndex = internalChunkIndex + 1;
    const originalButtonHTML = button.innerHTML;
    button.disabled = true;
    button.classList.add('loading');
    button.innerHTML = `<span class="spinner"></span> ${localStorage.getItem('language') === 'Persian' ? `در حال تلاش مجدد بخش ${userFacingIndex}...` : `Retrying Chunk ${userFacingIndex}...`}`;
    hideError();
    console.log(`Retrying translation for Chunk ${userFacingIndex}...`);

    try {
        const translatedChunkTexts = await translateChunk(
            failedChunkInfo.chunkData, // This contains the original { id, ..., text, otherData } objects
            currentApiKey, currentBaseDelay, currentQuotaDelay, currentLang,
            userFacingIndex, 1, currentModel, currentPromptTemplate,
            currentTemperature, currentTopP, currentTopK, currentMaxOutputTokens, currentStopSequencesStr
        );

        // --- MODIFIED: Update the main data store by matching objects/IDs ---
        let entriesUpdated = 0;
        const retriedEntriesMap = new Map();
        // Create a map of original entry object -> translated text for the retried chunk
         failedChunkInfo.chunkData.forEach((originalEntry, indexInChunk) => {
             const newText = (translatedChunkTexts && indexInChunk < translatedChunkTexts.length)
                             ? translatedChunkTexts[indexInChunk]
                             : originalEntry.text; // Fallback
             retriedEntriesMap.set(originalEntry, newText ?? originalEntry.text);
         });

        // Iterate through the *main* list and update entries found in the retried map
        currentAllTranslatedEntries = currentAllTranslatedEntries.map(entry => {
             if (retriedEntriesMap.has(entry)) {
                 entriesUpdated++;
                 return { ...entry, text: retriedEntriesMap.get(entry) };
             }
             return entry;
         });

        console.log(`Successfully retried chunk ${userFacingIndex}. Attempted to update ${failedChunkInfo.chunkData.length} entries, matched ${entriesUpdated}.`);
        if (entriesUpdated !== failedChunkInfo.chunkData.length) {
             console.warn("Mismatch during retry update - some original entries might not have been found in the main list.");
        }
        // --- END MODIFICATION ---


        // Remove this chunk from the failed list
        failedChunksData = failedChunksData.filter(fc => fc.index !== internalChunkIndex);

        // Update UI
        button.remove();
        showError(`Chunk ${userFacingIndex} successfully translated!`, true);
        generateAndDisplayDownloadLink(); // Update download link with corrected data
        displayRetryButtons(); // Refresh button list

        if (failedChunksData.length === 0) {
            const lang = localStorage.getItem('language') || 'English';
            showError(lang === 'Persian' ? 'همه بخش‌ها با موفقیت ترجمه شدند!' : 'All chunks successfully translated!', true);
            if (timeEstimateSpan) timeEstimateSpan.textContent = lang === 'Persian' ? "پایان موفقیت آمیز" : "Finished successfully";
        }

    } catch (retryError) {
        console.error(`Manual retry for chunk ${userFacingIndex} failed:`, retryError);
        showError(`Retry failed for Chunk ${userFacingIndex}: ${retryError.message}`, false);
        button.disabled = false;
        button.classList.remove('loading');
        button.innerHTML = originalButtonHTML;
    }
} // End handleManualRetry

// --- Event Listeners Setup --- (Moved inside DOMContentLoaded)
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed");

    // Load saved theme or default to light
    const savedTheme = localStorage.getItem('theme');
    // Set the initial theme state correctly
    updateTheme(savedTheme === 'light' || savedTheme === null); // Pass true for light, false for dark

    // Load saved language or default to English
    const savedLanguage = localStorage.getItem('language') || 'English';
    updateLanguage(savedLanguage);

    // Load saved API key
    loadApiKey();

    // Set initial state for input method display
    const initialInputMethod = document.querySelector('input[name="input_method"]:checked')?.value || 'file';
     if(fileInputSection) fileInputSection.style.display = initialInputMethod === 'file' ? 'block' : 'none';
     if(textInputSection) textInputSection.style.display = initialInputMethod === 'text' ? 'block' : 'none';

    // Attach listeners only after DOM is ready
    if (themeToggle) themeToggle.addEventListener('click', () => {
        // Toggle based on the *current* state
        const isCurrentlyLight = !htmlElement.classList.contains('dark-mode');
        updateTheme(!isCurrentlyLight); // Pass the *new* desired state
    });
    if (languageToggle) languageToggle.addEventListener('click', () => {
        const currentLanguage = localStorage.getItem('language') === 'Persian' ? 'English' : 'Persian';
        updateLanguage(currentLanguage);
        resetUI();
    });
    if (clearMemoryButton) clearMemoryButton.addEventListener('click', clearTranslationMemory);
    if (togglePasswordBtn) togglePasswordBtn.addEventListener('click', togglePasswordVisibility);
    if (rememberMeCheckbox) rememberMeCheckbox.addEventListener('change', saveApiKey);
    if (translateForm) translateForm.addEventListener('submit', handleTranslate);

    inputMethodRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const method = e.target.value;
             if(fileInputSection) fileInputSection.style.display = method === 'file' ? 'block' : 'none';
             if(textInputSection) textInputSection.style.display = method === 'text' ? 'block' : 'none';
            hideError();
        });
    });

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
            e.preventDefault(); themeToggle?.click();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            if (document.activeElement?.tagName !== 'TEXTAREA' && submitButton && !submitButton.disabled) {
                e.preventDefault(); translateForm?.requestSubmit();
            }
        }
    });

    console.log("Static Translator Initialized");
}); // End DOMContentLoaded
