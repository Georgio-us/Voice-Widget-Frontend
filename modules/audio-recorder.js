// ========================================
// 📁 modules/audio-recorder.js
// ========================================
// Запись и обработка аудио

export class AudioRecorder {
    constructor(widget) {
        this.widget = widget;
        this.isRecording = false;
        this.recordingTime = 0;
        this.recordingTimer = null;
        this.maxRecordingTime = 30;
        this.minRecordingTime = 1;
        this.mediaRecorder = null; 
        this.stream = null;
        this.audioBlob = null;
        this.recordedChunks = [];
    }

    async startRecording() {
        try {
            this.isRecording = true;
            this.recordingTime = 0;
            this.recordedChunks = [];
            this.audioBlob = null;

            const mainButton = this.widget.shadowRoot.getElementById('mainButton');
            const voiceButton = this.widget.shadowRoot.getElementById('voiceButton');
            const waveAnimation = this.widget.shadowRoot.getElementById('waveAnimation');
            const recordingControls = this.widget.shadowRoot.getElementById('recordingControls');

            mainButton.classList.add('recording');
            voiceButton.classList.add('recording');
            waveAnimation.classList.add('active');
            
            recordingControls.style.display = 'flex';
            recordingControls.classList.add('active');

            this.stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            let mimeType = '';
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                mimeType = 'audio/webm;codecs=opus';
            } else if (MediaRecorder.isTypeSupported('audio/webm')) {
                mimeType = 'audio/webm';
            }

            this.mediaRecorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : {});

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                if (this.recordedChunks.length > 0) {
                    this.audioBlob = new Blob(this.recordedChunks, mimeType ? { type: mimeType } : {});
                    console.log('✅ Аудио готово к отправке');
                }
            };

            this.mediaRecorder.onerror = (event) => {
                console.error('Ошибка записи:', event.error);
                this.handleRecordingError('Произошла ошибка во время записи');
            };

            this.mediaRecorder.start(100);

            this.recordingTimer = setInterval(() => {
                this.recordingTime++;
                this.widget.ui.updateTimer(this.recordingTime);

                if (this.recordingTime >= this.maxRecordingTime) {
                    this.finishAndSend();
                }
            }, 1000);

            this.widget.dispatchEvent(new CustomEvent('recordingStart'));

        } catch (err) {
            console.error('Ошибка доступа к микрофону:', err);
            this.handleRecordingError(this.getErrorMessage(err));
        }
    }

    cancelRecording() {
        if (!this.isRecording) return;

        console.log('🔴 Отменяем запись');

        this.isRecording = false;
        
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }

        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        const mainButton = this.widget.shadowRoot.getElementById('mainButton');
        const voiceButton = this.widget.shadowRoot.getElementById('voiceButton');
        const waveAnimation = this.widget.shadowRoot.getElementById('waveAnimation');
        const recordingControls = this.widget.shadowRoot.getElementById('recordingControls');

        mainButton.classList.remove('recording');
        voiceButton.classList.remove('recording');
        waveAnimation.classList.remove('active');
        recordingControls.style.display = 'none';
        recordingControls.classList.remove('active');

        this.cleanupRecording();
        this.widget.ui.showNotification('❌ Запись отменена');

        this.widget.dispatchEvent(new CustomEvent('recordingCancelled'));
    }

    async finishAndSend() {
        if (!this.isRecording) return;

        console.log('🟢 Завершаем запись и отправляем');

        if (this.recordingTime < this.minRecordingTime) {
            this.widget.ui.showNotification('⚠️ Запись слишком короткая');
            return;
        }

        this.isRecording = false;
        
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }

        const mainButton = this.widget.shadowRoot.getElementById('mainButton');
        const voiceButton = this.widget.shadowRoot.getElementById('voiceButton');
        const waveAnimation = this.widget.shadowRoot.getElementById('waveAnimation');

        mainButton.classList.remove('recording');
        voiceButton.classList.remove('recording');
        waveAnimation.classList.remove('active');

        await new Promise((resolve) => {
            this.mediaRecorder.onstop = () => {
                if (this.recordedChunks.length > 0) {
                    this.audioBlob = new Blob(this.recordedChunks, { 
                        type: this.mediaRecorder.mimeType || 'audio/webm' 
                    });
                    console.log('✅ Blob создан, отправляем...');
                    resolve();
                }
            };

            this.mediaRecorder.stop();
        });

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        this.widget.api.sendMessage();
    }

    handleRecordingError(message) {
        this.isRecording = false;
        
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }

        const mainButton = this.widget.shadowRoot.getElementById('mainButton');
        const voiceButton = this.widget.shadowRoot.getElementById('voiceButton');
        const waveAnimation = this.widget.shadowRoot.getElementById('waveAnimation');
        const recordingControls = this.widget.shadowRoot.getElementById('recordingControls');

        mainButton.classList.remove('recording');
        voiceButton.classList.remove('recording');
        waveAnimation.classList.remove('active');
        
        recordingControls.style.display = 'none';
        recordingControls.classList.remove('active');

        this.cleanupRecording();
        this.widget.ui.showNotification(`❌ ${message}`);
    }

    cleanupRecording() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        this.mediaRecorder = null;
        this.audioBlob = null;
        this.recordedChunks = [];
        this.recordingTime = 0;

        const timer = this.widget.shadowRoot.getElementById('timer');
        timer.textContent = '0:00';
    }

    cleanupAfterSend() {
        this.audioBlob = null;
        this.recordedChunks = [];
        this.recordingTime = 0;

        const timer = this.widget.shadowRoot.getElementById('timer');
        timer.textContent = '0:00';
        
        const recordingControls = this.widget.shadowRoot.getElementById('recordingControls');
        recordingControls.style.display = 'none';
        recordingControls.classList.remove('active');
    }

    getErrorMessage(error) {
        if (error.name === 'NotAllowedError') {
            return 'Доступ к микрофону запрещен';
        } else if (error.name === 'NotFoundError') {
            return 'Микрофон не найден';
        } else if (error.name === 'NotReadableError') {
            return 'Микрофон уже используется';
        } else if (error.name === 'OverconstrainedError') {
            return 'Настройки микрофона не поддерживаются';
        } else {
            return 'Ошибка доступа к микрофону';
        }
    }
}