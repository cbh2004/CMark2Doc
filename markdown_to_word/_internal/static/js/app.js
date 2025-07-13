// Markdown到Word转换器前端JavaScript

class MarkdownConverter {
    constructor() {
        this.editor = document.getElementById('markdown-editor');
        this.previewContent = document.getElementById('preview-content');
        this.fileInput = document.getElementById('file-input');
        this.clearBtn = document.getElementById('clear-btn');
        this.convertBtn = document.getElementById('convert-btn');
        this.imageOcrBtn = document.getElementById('image-ocr-btn');
        this.loading = document.getElementById('loading');
        this.wordCount = document.getElementById('word-count');
        this.lastUpdated = document.getElementById('last-updated');
        this.alertContainer = document.getElementById('alert-container');

        // 面板控制元素
        this.editorPanel = document.getElementById('editor-panel');
        this.previewPanel = document.getElementById('preview-panel');
        this.resizer = document.getElementById('resizer');
        this.editorFullscreenBtn = document.getElementById('editor-fullscreen');
        this.previewFullscreenBtn = document.getElementById('preview-fullscreen');

        this.debounceTimer = null;
        this.isResizing = false;
        this.init();
    }

    init() {
        // 绑定事件监听器
        this.editor.addEventListener('input', () => this.handleEditorInput());
        this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        this.clearBtn.addEventListener('click', () => this.clearEditor());
        this.convertBtn.addEventListener('click', () => this.convertToWord());
        this.imageOcrBtn.addEventListener('click', () => this.showImageUpload());

        // 面板控制事件
        this.setupPanelControls();

        // 检测MathJax状态
        this.checkMathJaxStatus();

        // 设置全局粘贴监听
        this.setupGlobalPaste();

        // 初始化预览
        this.updatePreview();
        this.updateWordCount();
    }

    handleEditorInput() {
        // 防抖处理，避免频繁更新预览
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.updatePreview();
            this.updateWordCount();
            this.updateLastModified();
        }, 300);
    }

    setupPanelControls() {
        // 调整大小功能
        this.resizer.addEventListener('mousedown', (e) => this.startResize(e));

        // 全屏功能
        this.editorFullscreenBtn.addEventListener('click', () => this.toggleFullscreen('editor'));
        this.previewFullscreenBtn.addEventListener('click', () => this.toggleFullscreen('preview'));

        // ESC键退出全屏
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.exitFullscreen();
            }
        });
    }

    startResize(e) {
        this.isResizing = true;
        document.addEventListener('mousemove', (e) => this.handleResize(e));
        document.addEventListener('mouseup', () => this.stopResize());
        e.preventDefault();
    }

    handleResize(e) {
        if (!this.isResizing) return;

        const container = document.querySelector('.main-content');
        const containerRect = container.getBoundingClientRect();
        const mouseX = e.clientX - containerRect.left;
        const containerWidth = containerRect.width;

        // 计算百分比，限制在20%-80%之间
        let leftPercent = (mouseX / containerWidth) * 100;
        leftPercent = Math.max(20, Math.min(80, leftPercent));

        this.editorPanel.style.flex = `0 0 ${leftPercent}%`;
        this.previewPanel.style.flex = `0 0 ${100 - leftPercent}%`;
    }

    stopResize() {
        this.isResizing = false;
        document.removeEventListener('mousemove', this.handleResize);
        document.removeEventListener('mouseup', this.stopResize);
    }

    toggleFullscreen(panel) {
        const targetPanel = panel === 'editor' ? this.editorPanel : this.previewPanel;
        const targetBtn = panel === 'editor' ? this.editorFullscreenBtn : this.previewFullscreenBtn;

        if (targetPanel.classList.contains('fullscreen')) {
            this.exitFullscreen();
        } else {
            // 退出其他全屏
            this.exitFullscreen();

            // 进入全屏
            targetPanel.classList.add('fullscreen');
            targetBtn.innerHTML = '<i class="fas fa-compress"></i>';
            targetBtn.title = '退出全屏';

            // 隐藏其他面板
            if (panel === 'editor') {
                this.previewPanel.style.display = 'none';
                this.resizer.style.display = 'none';
            } else {
                this.editorPanel.style.display = 'none';
                this.resizer.style.display = 'none';
            }
        }
    }

    exitFullscreen() {
        // 恢复编辑器面板
        this.editorPanel.classList.remove('fullscreen');
        this.editorPanel.style.display = 'flex';
        this.editorPanel.style.flex = '1';
        this.editorFullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
        this.editorFullscreenBtn.title = '全屏编辑';

        // 恢复预览面板
        this.previewPanel.classList.remove('fullscreen');
        this.previewPanel.style.display = 'flex';
        this.previewPanel.style.flex = '1';
        this.previewFullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
        this.previewFullscreenBtn.title = '全屏预览';

        // 恢复调整器
        this.resizer.style.display = 'block';
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.showLoading(true);
        
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                this.editor.value = result.content;
                this.updatePreview();
                this.updateWordCount();
                this.updateLastModified();
                this.showAlert('文件上传成功！', 'success');
            } else {
                this.showAlert(result.error || '文件上传失败', 'error');
            }
        } catch (error) {
            this.showAlert('文件上传失败: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
            // 清空文件输入，允许重复上传同一文件
            this.fileInput.value = '';
        }
    }

    async updatePreview() {
        const content = this.editor.value;
        
        if (!content.trim()) {
            this.previewContent.innerHTML = `
                <p style="color: #6c757d; text-align: center; margin-top: 50px;">
                    <i class="fas fa-info-circle"></i> 在左侧编辑器中输入Markdown内容，这里将显示实时预览
                </p>
            `;
            return;
        }

        try {
            const response = await fetch('/api/preview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content: content })
            });

            const result = await response.json();

            if (result.success) {
                this.previewContent.innerHTML = result.html;

                // 高亮代码块
                if (window.Prism) {
                    Prism.highlightAllUnder(this.previewContent);
                }

                // 重新渲染数学公式
                this.renderMathJax();
            } else {
                this.previewContent.innerHTML = `<p style="color: red;">预览生成失败: ${result.error}</p>`;
            }
        } catch (error) {
            this.previewContent.innerHTML = `<p style="color: red;">预览生成失败: ${error.message}</p>`;
        }
    }

    checkMathJaxStatus() {
        const statusElement = document.getElementById('mathjax-status');
        if (!statusElement) return;

        const checkInterval = setInterval(() => {
            if (typeof window.MathJax !== 'undefined' && window.MathJax.typesetPromise) {
                statusElement.innerHTML = '<span style="color: green;">✅ 数学公式渲染器已就绪</span>';
                clearInterval(checkInterval);
            } else if (typeof window.MathJax !== 'undefined') {
                statusElement.innerHTML = '<span style="color: orange;">⏳ 数学公式渲染器初始化中...</span>';
            } else {
                statusElement.innerHTML = '<span style="color: red;">⚠️ 数学公式渲染器加载中...</span>';
            }
        }, 500);

        // 10秒后停止检测
        setTimeout(() => {
            clearInterval(checkInterval);
            if (typeof window.MathJax === 'undefined') {
                statusElement.innerHTML = '<span style="color: red;">❌ 数学公式渲染器加载失败</span>';
            }
        }, 10000);
    }

    renderMathJax() {
        // 强制清除并重新渲染MathJax
        if (window.MathJax && window.MathJax.typesetPromise) {
            try {
                console.log('🔄 强制重新渲染MathJax...');

                // 先清除之前的渲染
                if (window.MathJax.typesetClear) {
                    window.MathJax.typesetClear([this.previewContent]);
                }

                // 重新渲染
                window.MathJax.typesetPromise([this.previewContent]).then(() => {
                    console.log('✅ MathJax渲染完成');
                }).catch((err) => {
                    console.log('❌ MathJax渲染失败:', err);
                    // 如果渲染失败，显示原始内容
                    this.showMathError();
                });
            } catch (err) {
                console.log('❌ MathJax渲染异常:', err);
                this.showMathError();
            }
        } else {
            console.log('⚠️ MathJax未就绪，稍后重试...');
            setTimeout(() => this.renderMathJax(), 500);
        }
    }

    showMathError() {
        // 显示数学公式错误提示
        const mathErrors = this.previewContent.querySelectorAll('.MathJax_Error, .merror');
        mathErrors.forEach(error => {
            error.style.backgroundColor = '#ffe6e6';
            error.style.color = '#d32f2f';
            error.style.padding = '2px 4px';
            error.style.borderRadius = '3px';
            error.title = '数学公式语法错误，请检查LaTeX语法';
        });
    }

    addMathTooltips() {
        // 为MathJax渲染的数学公式添加提示信息
        const mathElements = this.previewContent.querySelectorAll('.MathJax');
        const inlineMathElements = this.previewContent.querySelectorAll('mjx-container[jax="CHTML"][display="false"]');
        const blockMathElements = this.previewContent.querySelectorAll('mjx-container[jax="CHTML"][display="true"]');

        // 为所有数学公式添加样式和提示
        mathElements.forEach(element => {
            element.style.cursor = 'help';
            element.title = '数学公式 - 将转换为可编辑的Word公式';
        });

        inlineMathElements.forEach(element => {
            element.style.cursor = 'help';
            element.title = '行内数学公式 - 将转换为可编辑的Word公式';
            element.style.backgroundColor = '#e8f4fd';
            element.style.padding = '2px 4px';
            element.style.borderRadius = '3px';
            element.style.border = '1px solid #b3d9ff';
        });

        blockMathElements.forEach(element => {
            element.style.cursor = 'help';
            element.title = '块级数学公式 - 将转换为可编辑的Word公式';
            element.style.backgroundColor = '#f8f9fa';
            element.style.padding = '10px';
            element.style.borderRadius = '5px';
            element.style.border = '1px solid #dee2e6';
            element.style.borderLeft = '4px solid #007bff';
            element.style.margin = '10px 0';
        });
    }

    async convertToWord() {
        const content = this.editor.value;
        
        if (!content.trim()) {
            this.showAlert('请先输入Markdown内容', 'error');
            return;
        }

        this.showLoading(true);
        this.convertBtn.disabled = true;

        try {
            const response = await fetch('/api/convert', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    content: content,
                    filename: 'document'
                })
            });

            const result = await response.json();

            if (result.success) {
                // 下载文件
                const downloadUrl = `/api/download/${result.download_id}`;
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = result.filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                this.showAlert('转换成功！文件正在下载...', 'success');
            } else {
                this.showAlert(result.error || '转换失败', 'error');
            }
        } catch (error) {
            this.showAlert('转换失败: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
            this.convertBtn.disabled = false;
        }
    }

    clearEditor() {
        if (this.editor.value.trim() && !confirm('确定要清空所有内容吗？')) {
            return;
        }
        
        this.editor.value = '';
        this.updatePreview();
        this.updateWordCount();
        this.updateLastModified();
        this.showAlert('内容已清空', 'success');
    }



    updateWordCount() {
        const content = this.editor.value;
        const wordCount = content.length;
        const lineCount = content.split('\n').length;
        this.wordCount.textContent = `字数: ${wordCount} | 行数: ${lineCount}`;
    }

    updateLastModified() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('zh-CN');
        this.lastUpdated.textContent = `最后更新: ${timeString}`;
    }

    showLoading(show) {
        if (show) {
            this.loading.classList.add('show');
        } else {
            this.loading.classList.remove('show');
        }
    }

    showAlert(message, type) {
        // 移除现有的alert
        const existingAlerts = this.alertContainer.querySelectorAll('.alert');
        existingAlerts.forEach(alert => alert.remove());

        // 创建新的alert
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} show`;
        alert.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            ${message}
        `;

        this.alertContainer.appendChild(alert);

        // 3秒后自动隐藏
        setTimeout(() => {
            alert.classList.remove('show');
            setTimeout(() => alert.remove(), 300);
        }, 3000);
    }

    // 图片OCR功能
    showImageUpload() {
        const modal = document.getElementById('imageUploadModal');
        modal.style.display = 'flex';

        // 确保模态框可以接收焦点和粘贴事件
        modal.setAttribute('tabindex', '-1');
        setTimeout(() => {
            modal.focus();
            console.log('模态框已获得焦点，可以粘贴图片');
        }, 100);

        // 只在第一次时设置事件监听器
        if (!this.imageUploadInitialized) {
            this.setupImageUpload();
            this.imageUploadInitialized = true;
        }

        // 重置上传状态
        this.resetUpload();
    }

    setupImageUpload() {
        const uploadArea = document.getElementById('uploadArea');
        const imageInput = document.getElementById('imageInput');
        const modal = document.getElementById('imageUploadModal');

        console.log('设置图片上传功能...');

        // 设置拖拽上传
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.add('dragover');
            console.log('拖拽悬停');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            console.log('拖拽放下文件:', files.length);
            if (files.length > 0) {
                this.handleImageFile(files[0]);
            }
        });

        // 点击上传区域触发文件选择
        uploadArea.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON') {
                console.log('点击上传区域');
                imageInput.click();
            }
        });

        // 文件选择
        imageInput.addEventListener('change', (e) => {
            console.log('文件选择变化:', e.target.files.length);
            if (e.target.files.length > 0) {
                this.handleImageFile(e.target.files[0]);
            }
        });

        // 模态框粘贴事件
        modal.addEventListener('paste', (e) => {
            console.log('模态框粘贴事件触发');
            e.preventDefault();
            e.stopPropagation();

            const items = e.clipboardData.items;
            console.log('剪贴板项目数量:', items.length);

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                console.log('项目类型:', item.type);

                if (item.type.indexOf('image') !== -1) {
                    console.log('找到图片，开始处理');
                    const blob = item.getAsFile();
                    this.handleImageFile(blob);
                    break;
                }
            }
        });

        // 全局粘贴事件（当模态框打开时）
        document.addEventListener('paste', (e) => {
            if (modal.style.display === 'flex') {
                console.log('全局粘贴事件触发（模态框打开）');
                e.preventDefault();

                const items = e.clipboardData.items;
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    if (item.type.indexOf('image') !== -1) {
                        const blob = item.getAsFile();
                        this.handleImageFile(blob);
                        break;
                    }
                }
            }
        });

        // 为按钮添加事件监听器
        const selectImageBtn = document.getElementById('selectImageBtn');
        const pasteImageBtn = document.getElementById('pasteImageBtn');

        if (selectImageBtn) {
            selectImageBtn.addEventListener('click', () => {
                console.log('点击选择图片按钮');
                imageInput.click();
            });
        }

        if (pasteImageBtn) {
            pasteImageBtn.addEventListener('click', () => {
                console.log('点击粘贴按钮');
                modal.focus();
                this.showAlert('请按 Ctrl+V 粘贴图片', 'info');
            });
        }

        console.log('图片上传功能设置完成');
    }

    handleImageFile(file) {
        console.log('处理图片文件:', file);

        // 检查文件是否存在
        if (!file) {
            console.error('没有文件');
            this.showAlert('没有选择文件', 'error');
            return;
        }

        // 检查文件类型
        if (!file.type || !file.type.startsWith('image/')) {
            console.error('文件类型错误:', file.type);
            this.showAlert('请选择图片文件（PNG、JPG、JPEG等格式）', 'error');
            return;
        }

        // 检查文件大小（限制为10MB）
        if (file.size > 10 * 1024 * 1024) {
            console.error('文件过大:', file.size);
            this.showAlert('图片文件过大，请选择小于10MB的图片', 'error');
            return;
        }

        console.log('开始读取文件...');
        const reader = new FileReader();

        reader.onload = (e) => {
            console.log('文件读取成功');

            const uploadArea = document.getElementById('uploadArea');
            const imagePreview = document.getElementById('imagePreview');
            const previewImg = document.getElementById('previewImg');
            const recognitionResult = document.getElementById('recognitionResult');
            const recognitionLoading = document.getElementById('recognitionLoading');

            // 重置状态
            recognitionResult.style.display = 'none';
            recognitionLoading.style.display = 'none';

            // 设置图片预览
            previewImg.src = e.target.result;
            previewImg.onload = () => {
                console.log('图片预览加载完成');
            };

            uploadArea.style.display = 'none';
            imagePreview.style.display = 'block';

            // 显示文件信息
            const fileInfo = document.createElement('div');
            fileInfo.style.cssText = 'margin-top: 10px; font-size: 12px; color: #666; padding: 8px; background: #f8f9fa; border-radius: 4px;';
            fileInfo.innerHTML = `
                <i class="fas fa-info-circle"></i>
                文件名: ${file.name || '粘贴的图片'} |
                大小: ${(file.size / 1024).toFixed(1)} KB |
                类型: ${file.type}
            `;

            // 移除之前的文件信息
            const existingInfo = imagePreview.querySelector('.file-info');
            if (existingInfo) {
                existingInfo.remove();
            }

            fileInfo.className = 'file-info';
            imagePreview.appendChild(fileInfo);

            // 保存文件引用供后续使用
            this.currentImageFile = file;

            console.log('图片处理完成，可以进行识别');
        };

        reader.onerror = (error) => {
            console.error('读取文件失败:', error);
            this.showAlert('读取图片文件失败', 'error');
        };

        reader.readAsDataURL(file);
    }

    async recognizeFormula() {
        const previewImg = document.getElementById('previewImg');
        const recognitionLoading = document.getElementById('recognitionLoading');
        const recognitionResult = document.getElementById('recognitionResult');
        const resultContent = document.getElementById('resultContent');

        // 显示加载状态
        recognitionLoading.style.display = 'block';
        recognitionResult.style.display = 'none';

        try {
            // 将图片转换为blob
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = previewImg.naturalWidth;
            canvas.height = previewImg.naturalHeight;
            ctx.drawImage(previewImg, 0, 0);

            canvas.toBlob(async (blob) => {
                const formData = new FormData();
                formData.append('image', blob, 'formula.png');

                try {
                    const response = await fetch('/recognize_formula', {
                        method: 'POST',
                        body: formData
                    });

                    const result = await response.json();

                    recognitionLoading.style.display = 'none';

                    if (result.success) {
                        resultContent.innerHTML = `
                            <div style="margin-bottom: 10px;">
                                <strong>识别方法:</strong> ${result.method}
                                <span style="margin-left: 10px; color: ${result.confidence === 'high' ? '#28a745' : '#ffc107'};">
                                    ${result.confidence === 'high' ? '高精度' : '中等精度'}
                                </span>
                            </div>
                            <div style="margin-bottom: 10px;">
                                <strong>LaTeX代码:</strong>
                            </div>
                            <code style="background: #f8f9fa; padding: 10px; border-radius: 4px; display: block; margin-bottom: 10px;">
                                ${result.latex}
                            </code>
                            <div style="margin-bottom: 10px;">
                                <strong>预览:</strong>
                            </div>
                            <div style="border: 1px solid #ddd; padding: 15px; border-radius: 4px; text-align: center;">
                                $${result.latex}$
                            </div>
                        `;

                        // 重新渲染数学公式
                        if (window.MathJax) {
                            MathJax.typesetPromise([resultContent]);
                        }

                        recognitionResult.style.display = 'block';
                        this.recognizedLatex = result.latex;
                    } else {
                        resultContent.innerHTML = `
                            <div style="color: #dc3545; margin-bottom: 10px;">
                                <i class="fas fa-exclamation-triangle"></i> ${result.error}
                            </div>
                            ${result.suggestions ? `
                                <div>
                                    <strong>建议:</strong>
                                    <ul style="margin-top: 5px;">
                                        ${result.suggestions.map(s => `<li>${s}</li>`).join('')}
                                    </ul>
                                </div>
                            ` : ''}
                        `;
                        recognitionResult.style.display = 'block';
                    }
                } catch (error) {
                    recognitionLoading.style.display = 'none';
                    this.showAlert('识别请求失败: ' + error.message, 'error');
                }
            }, 'image/png');

        } catch (error) {
            recognitionLoading.style.display = 'none';
            this.showAlert('处理图片失败: ' + error.message, 'error');
        }
    }

    insertRecognizedFormula() {
        if (this.recognizedLatex) {
            const currentPos = this.editor.selectionStart;
            const currentValue = this.editor.value;
            const newValue = currentValue.slice(0, currentPos) +
                           `$$${this.recognizedLatex}$$` +
                           currentValue.slice(currentPos);

            this.editor.value = newValue;
            this.editor.focus();

            // 更新预览
            this.updatePreview();
            this.updateWordCount();

            // 关闭模态框
            this.closeImageUpload();

            this.showAlert('公式已插入到编辑器', 'success');
        }
    }

    closeImageUpload() {
        const modal = document.getElementById('imageUploadModal');
        modal.style.display = 'none';
        this.resetUpload();
    }

    resetUpload() {
        const uploadArea = document.getElementById('uploadArea');
        const imagePreview = document.getElementById('imagePreview');
        const recognitionResult = document.getElementById('recognitionResult');
        const recognitionLoading = document.getElementById('recognitionLoading');
        const imageInput = document.getElementById('imageInput');

        uploadArea.style.display = 'block';
        imagePreview.style.display = 'none';
        recognitionResult.style.display = 'none';
        recognitionLoading.style.display = 'none';
        imageInput.value = '';
        this.recognizedLatex = null;
    }

    setupGlobalPaste() {
        // 全局粘贴监听
        document.addEventListener('paste', (e) => {
            // 检查是否在输入框中粘贴
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT')) {
                return; // 让输入框正常处理粘贴
            }

            // 检查剪贴板中是否有图片
            const items = e.clipboardData.items;
            let hasImage = false;

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.type.indexOf('image') !== -1) {
                    hasImage = true;
                    break;
                }
            }

            if (hasImage) {
                e.preventDefault();

                // 显示提示，询问是否要识别公式
                if (confirm('检测到剪贴板中有图片，是否要识别其中的数学公式？')) {
                    this.showImageUpload();

                    // 延迟一点再处理粘贴，确保模态框已显示
                    setTimeout(() => {
                        for (let i = 0; i < items.length; i++) {
                            const item = items[i];
                            if (item.type.indexOf('image') !== -1) {
                                const blob = item.getAsFile();
                                this.handleImageFile(blob);
                                break;
                            }
                        }
                    }, 100);
                }
            }
        });

        // 添加键盘快捷键提示
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'v' && !e.target.matches('input, textarea')) {
                // 显示粘贴提示
                this.showPasteHint();
            }
        });
    }

    showPasteHint() {
        // 创建临时提示
        const hint = document.createElement('div');
        hint.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #007bff;
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            z-index: 10000;
            font-size: 14px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            transition: opacity 0.3s;
        `;
        hint.innerHTML = '<i class="fas fa-info-circle"></i> 粘贴图片可自动识别数学公式';

        document.body.appendChild(hint);

        // 3秒后移除提示
        setTimeout(() => {
            hint.style.opacity = '0';
            setTimeout(() => {
                if (hint.parentNode) {
                    hint.parentNode.removeChild(hint);
                }
            }, 300);
        }, 3000);
    }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.converter = new MarkdownConverter();
});

// 全局函数供HTML调用
window.closeImageUpload = function() {
    if (window.converter) {
        window.converter.closeImageUpload();
    }
};

window.resetUpload = function() {
    if (window.converter) {
        window.converter.resetUpload();
    }
};

window.recognizeFormula = function() {
    if (window.converter) {
        window.converter.recognizeFormula();
    }
};

window.insertRecognizedFormula = function() {
    if (window.converter) {
        window.converter.insertRecognizedFormula();
    }
};

// 添加键盘快捷键支持
document.addEventListener('keydown', (e) => {
    // Ctrl+S 保存（转换为Word）
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        document.getElementById('convert-btn').click();
    }
    
    // Ctrl+O 打开文件
    if (e.ctrlKey && e.key === 'o') {
        e.preventDefault();
        document.getElementById('file-input').click();
    }
    
    // Ctrl+N 新建（清空）
    if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        document.getElementById('clear-btn').click();
    }
});

// 添加拖拽上传支持
document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('markdown-editor');
    
    // 防止默认的拖拽行为
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        editor.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    // 高亮拖拽区域
    ['dragenter', 'dragover'].forEach(eventName => {
        editor.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        editor.addEventListener(eventName, unhighlight, false);
    });
    
    // 处理文件拖拽
    editor.addEventListener('drop', handleDrop, false);
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    function highlight() {
        editor.style.backgroundColor = '#f0f8ff';
        editor.style.borderColor = '#007bff';
    }

    function unhighlight() {
        editor.style.backgroundColor = '';
        editor.style.borderColor = '';
    }
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files.length > 0) {
            const file = files[0];
            if (file.type === 'text/markdown' || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    editor.value = e.target.result;
                    // 触发输入事件以更新预览
                    editor.dispatchEvent(new Event('input'));
                };
                reader.readAsText(file);
            }
        }
    }
});
