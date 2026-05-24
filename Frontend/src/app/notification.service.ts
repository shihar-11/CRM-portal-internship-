import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface Toast {
  message: string;
  type: 'success' | 'error' | 'info';
  id?: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private toastsSubject = new Subject<Toast>();
  toasts$ = this.toastsSubject.asObservable();

  constructor() { }

  showSuccess(message: string) {
    this.toastsSubject.next({ message, type: 'success', id: Date.now() });
  }

  showError(message: string) {
    this.toastsSubject.next({ message, type: 'error', id: Date.now() });
  }

  showInfo(message: string) {
    this.toastsSubject.next({ message, type: 'info', id: Date.now() });
  }
}
