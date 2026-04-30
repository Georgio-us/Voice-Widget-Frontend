// ========================================
// 📁 modules/audio-recorder.js (ИСПРАВЛЕННАЯ ВЕРСИЯ)
// ========================================
// Запись и обработка аудио

export class AudioRecorder {
    constructor(widget) {
        this.widget = widget;
        this.isRecording = false;
        this.recordingTime = 0;
        this.recordingTimer = null;
        this.maxRecordingTime = 60;
        this.minRecordingTime = 1;
        this.mediaRecorder = null; 
        this.stream = null;
        this.audioBlob = null;
        this.recordedChunks = [];
    }

    t(key) {
        if (this.widget && typeof this.widget.t === 'function') {
            return this.widget.t(key);
        }
        return '';
    }

    async startRecording() {
        try {
            this.isRecording = true;
            this.recordingTime = 0;
            this.recordedChunks = [];
            this.audioBlob = null;

            // 🔥 ГЕНЕРИРУЕМ СОБЫТИЕ ДЛЯ UI MANAGER
            this.widget.events.emit('recordingStarted');

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
                this.handleRecordingError(this.t('micErrorDuringRecord'));
            };

            this.mediaRecorder.start(100);

            // 🔥 ИСПОЛЬЗУЕМ ТОЛЬКО СИСТЕМУ СОБЫТИЙ (убираем прямую манипуляцию DOM)
            this.recordingTimer = setInterval(() => {
                this.recordingTime++;
                this.widget.events.emit('timerUpdated', this.recordingTime);

                if (this.recordingTime >= this.maxRecordingTime) {
                    this.finishAndSend();
                }
            }, 1000);

            console.log('🎤 Запись началась');

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

        this.cleanupRecording();
        
        // 🔥 ГЕНЕРИРУЕМ СОБЫТИЕ ОТМЕНЫ
        this.widget.events.emit('recordingCancelled');
        this.widget.events.emit('notification', `❌ ${this.t('recordingCancelled')}`);
    }

    async finishAndSend() {
        if (!this.isRecording) return;

        console.log('🟢 Завершаем запись и отправляем');

        if (this.recordingTime < this.minRecordingTime) {
            this.widget.events.emit('notification', `⚠️ ${this.t('shortRecording')}`);
            return;
        }

        this.isRecording = false;
        
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }

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

        // 🔥 ГЕНЕРИРУЕМ СОБЫТИЕ ОСТАНОВКИ ЗАПИСИ
        this.widget.events.emit('recordingStopped');

        // Отправляем через API
        this.widget.api.sendMessage();
    }

    handleRecordingError(message) {
        this.isRecording = false;
        
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }

        this.cleanupRecording();
        
        // 🔥 ГЕНЕРИРУЕМ СОБЫТИЯ ОШИБКИ
        this.widget.events.emit('recordingCancelled');
        this.widget.events.emit('notification', `❌ ${message}`);
        this.widget.events.emit('error', new Error(message));
    }

    cleanupRecording() {
        this.isRecording = false;
        
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
        
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        this.mediaRecorder = null;
        this.audioBlob = null;
        this.recordedChunks = [];
        this.recordingTime = 0;
    }

    cleanupAfterSend() {
        this.audioBlob = null;
        this.recordedChunks = [];
        this.recordingTime = 0;
    }

    getErrorMessage(error) {
        if (error.name === 'NotAllowedError') {
            return this.t('micAccessDenied');
        } else if (error.name === 'NotFoundError') {
            return this.t('micNotFound');
        } else if (error.name === 'NotReadableError') {
            return this.t('micBusy');
        } else if (error.name === 'OverconstrainedError') {
            return this.t('micUnsupported');
        } else {
            return this.t('micAccessError');
        }
    }
}
