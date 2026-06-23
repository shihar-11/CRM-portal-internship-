import { Injectable, NgZone } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export interface SseMessage {
  type: string;
  data: any;
}

@Injectable({
  providedIn: 'root'
})
export class SseStreamService {
  private eventSource: EventSource | null = null;
  private messagesSubject = new Subject<SseMessage>();
  public messages$ = this.messagesSubject.asObservable();

  constructor(private zone: NgZone) {
    this.connect();
  }

  private connect() {
    if (this.eventSource) {
      return;
    }

    this.eventSource = new EventSource('http://localhost:3000/api/leads/stream');

    this.eventSource.onmessage = (event) => {
      // EventSource callbacks run outside Angular zone usually, 
      // but wrapping them ensures UI updates immediately
      this.zone.run(() => {
        try {
          const parsedData = JSON.parse(event.data);
          this.messagesSubject.next(parsedData);
        } catch (e) {
          console.error('Error parsing SSE message', e);
        }
      });
    };

    this.eventSource.onerror = (error) => {
      console.error('SSE Error', error);
      // Reconnection is handled automatically by EventSource,
      // but we could implement exponential backoff here if needed.
    };
  }

  ngOnDestroy() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}
