(function () {
  if (typeof CMS === 'undefined') return;

  var escapeHtml = function (input) {
    return String(input == null ? '' : input)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  };

  CMS.registerEditorComponent({
    id: 'image-block',
    label: '圖片（含尺寸建議）',
    fields: [
      { name: 'src', label: '圖片', widget: 'image' },
      { name: 'alt', label: '替代文字', widget: 'string', required: false },
      {
        name: 'preset',
        label: '尺寸預設',
        widget: 'select',
        default: 'article',
        options: [
          { label: '封面橫圖 1600x1000', value: 'cover-1600x1000' },
          { label: '文內橫圖 1200x800', value: 'article-1200x800' },
          { label: '社群直圖 1080x1350', value: 'portrait-1080x1350' }
        ]
      },
      { name: 'caption', label: '圖片說明', widget: 'string', required: false }
    ],
    pattern: /!\[(.*?)\]\((.*?)\)\n<!--\s*preset:(.*?)\s*-->\n?(?:\*(.*?)\*)?/,
    fromBlock: function (match) {
      return {
        alt: match[1] || '',
        src: match[2] || '',
        preset: match[3] || 'article-1200x800',
        caption: match[4] || ''
      };
    },
    toBlock: function (obj) {
      var alt = obj.alt || '';
      var src = obj.src || '';
      var preset = obj.preset || 'article-1200x800';
      var caption = obj.caption ? '\n*' + obj.caption + '*' : '';
      return '![' + alt + '](' + src + ')\n<!-- preset:' + preset + ' -->' + caption;
    },
    toPreview: function (obj) {
      var caption = obj.caption ? '<figcaption>' + escapeHtml(obj.caption) + '</figcaption>' : '';
      return '<figure><img src="' + escapeHtml(obj.src || '') + '" alt="' + escapeHtml(obj.alt || '') + '"/>' + caption + '</figure>';
    }
  });

  CMS.registerEditorComponent({
    id: 'audio-block',
    label: '音訊（Cloudflare）',
    fields: [
      { name: 'src', label: '音訊 URL', widget: 'string', hint: '可用右下角「上傳音訊到 Cloudflare」按鈕自動插入' },
      { name: 'title', label: '音訊標題', widget: 'string', required: false },
      { name: 'caption', label: '音訊說明', widget: 'string', required: false }
    ],
    pattern: /\[audio\]\((.*?)\)\n<!--\s*title:(.*?)\s*-->\n?(?:\*(.*?)\*)?/,
    fromBlock: function (match) {
      return {
        src: match[1] || '',
        title: match[2] || '',
        caption: match[3] || ''
      };
    },
    toBlock: function (obj) {
      var src = obj.src || '';
      var title = obj.title || '';
      var caption = obj.caption ? '\n*' + obj.caption + '*' : '';
      return '[audio](' + src + ')\n<!-- title:' + title + ' -->' + caption;
    },
    toPreview: function (obj) {
      var title = obj.title ? '<strong>' + escapeHtml(obj.title) + '</strong>' : '';
      var caption = obj.caption ? '<div>' + escapeHtml(obj.caption) + '</div>' : '';
      return (
        '<figure>' +
        title +
        '<audio controls preload="metadata" src="' +
        escapeHtml(obj.src || '') +
        '"></audio>' +
        caption +
        '</figure>'
      );
    }
  });

  var UPLOAD_BUTTON_ID = 'cfAudioUploadButton';
  var lastEditorSelection = {
    textarea: null,
    start: 0,
    end: 0
  };

  var escapeMd = function (input) {
    return String(input == null ? '' : input).replaceAll('\n', ' ').replaceAll('\r', ' ').replaceAll('*', '\\*');
  };

  var fileTitle = function (name) {
    return String(name || '未命名音訊').replace(/\.[^.]+$/, '');
  };

  var rememberSelection = function (el) {
    if (!el || el.tagName !== 'TEXTAREA') return;
    lastEditorSelection.textarea = el;
    lastEditorSelection.start = Number.isFinite(el.selectionStart) ? el.selectionStart : el.value.length;
    lastEditorSelection.end = Number.isFinite(el.selectionEnd) ? el.selectionEnd : el.value.length;
  };

  var findEditorTextarea = function () {
    if (lastEditorSelection.textarea && document.contains(lastEditorSelection.textarea)) {
      return lastEditorSelection.textarea;
    }
    var candidates = Array.from(document.querySelectorAll("textarea")).filter(function (el) {
      return el.offsetParent !== null;
    });
    if (candidates.length === 0) return null;
    return candidates[0];
  };

  var insertAtCursor = function (markdown) {
    var el = findEditorTextarea();
    if (!el) throw new Error('找不到文章編輯區（textarea）');
    var value = el.value || '';
    var start = Number.isFinite(lastEditorSelection.start) ? lastEditorSelection.start : value.length;
    var end = Number.isFinite(lastEditorSelection.end) ? lastEditorSelection.end : start;
    var prefix = value.slice(0, start);
    var suffix = value.slice(end);
    var needsLeadingNewline = prefix && !prefix.endsWith('\n');
    var needsTrailingNewline = suffix && !suffix.startsWith('\n');
    var block = (needsLeadingNewline ? '\n' : '') + markdown + (needsTrailingNewline ? '\n' : '');
    var next = prefix + block + suffix;
    el.value = next;
    var caret = prefix.length + block.length;
    el.selectionStart = caret;
    el.selectionEnd = caret;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.focus();
    rememberSelection(el);
  };

  var uploadAudioToCloudflare = async function (file) {
    var signRes = await fetch('/api/r2-upload-sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size
      })
    });
    var signJson = await signRes.json().catch(function () {
      return {};
    });
    if (!signRes.ok) {
      throw new Error(signJson.error || '取得 Cloudflare 上傳簽名失敗');
    }

    var putRes = await fetch(signJson.uploadUrl, {
      method: signJson.method || 'PUT',
      headers: signJson.headers || { 'Content-Type': file.type || 'application/octet-stream' },
      body: file
    });
    if (!putRes.ok) {
      throw new Error('上傳到 Cloudflare 失敗（' + putRes.status + '）');
    }

    return signJson.publicUrl;
  };

  var mountUploaderButton = function () {
    if (document.getElementById(UPLOAD_BUTTON_ID)) return;
    var btn = document.createElement('button');
    btn.id = UPLOAD_BUTTON_ID;
    btn.type = 'button';
    btn.textContent = '上傳音訊到 Cloudflare';
    btn.style.position = 'fixed';
    btn.style.right = '22px';
    btn.style.bottom = '22px';
    btn.style.zIndex = '9999';
    btn.style.border = '0';
    btn.style.borderRadius = '999px';
    btn.style.padding = '10px 14px';
    btn.style.fontSize = '13px';
    btn.style.cursor = 'pointer';
    btn.style.background = '#1f7ae0';
    btn.style.color = '#fff';
    btn.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.2)';

    btn.addEventListener('click', function () {
      var fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'audio/*,.mp3,.m4a,.wav,.aac,.ogg,.flac';
      fileInput.onchange = async function () {
        var file = fileInput.files && fileInput.files[0];
        if (!file) return;
        var originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '上傳中...';
        try {
          var publicUrl = await uploadAudioToCloudflare(file);
          var title = escapeMd(fileTitle(file.name));
          var markdown = '[audio](' + publicUrl + ')\n<!-- title:' + title + ' -->';
          insertAtCursor(markdown);
          btn.textContent = '已插入音訊';
          setTimeout(function () {
            btn.textContent = originalText;
            btn.disabled = false;
          }, 1400);
        } catch (err) {
          console.error(err);
          alert(err && err.message ? err.message : '音訊上傳失敗');
          btn.textContent = originalText;
          btn.disabled = false;
        }
      };
      fileInput.click();
    });

    document.body.appendChild(btn);
  };

  document.addEventListener(
    'focusin',
    function (event) {
      rememberSelection(event.target);
    },
    true
  );
  document.addEventListener(
    'click',
    function (event) {
      rememberSelection(event.target);
    },
    true
  );
  document.addEventListener(
    'keyup',
    function (event) {
      rememberSelection(event.target);
    },
    true
  );
  document.addEventListener(
    'select',
    function (event) {
      rememberSelection(event.target);
    },
    true
  );

  var boot = function () {
    mountUploaderButton();
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
