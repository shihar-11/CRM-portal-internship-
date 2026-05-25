import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Notification {
  id: number;
  message: string;
  type: string;
  lead_name: string;
  is_read: boolean;
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class BellNotificationService {
  private apiUrl = 'http://localhost:3000/api/notifications';
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();
  
  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();

  private pollingInterval: any;

  constructor(private http: HttpClient) {
    this.fetchNotifications();
    this.startPolling();
  }

  private startPolling() {
    this.pollingInterval = setInterval(() => {
      this.fetchNotifications();
    }, 30000); // 30 seconds
  }

  fetchNotifications() {
    this.http.get<Notification[]>(this.apiUrl).subscribe({
      next: (data) => {
        this.notificationsSubject.next(data);
        const unread = data.filter(n => !n.is_read).length;
        this.unreadCountSubject.next(unread);
      },
      error: (err) => console.error('Failed to fetch notifications', err)
    });
  }

  markAsRead(id: number): Observable<any> {
    const request = this.http.patch(`${this.apiUrl}/${id}/read`, {});
    request.subscribe(() => this.fetchNotifications());
    return request;
  }

  markAllAsRead(): Observable<any> {
    const request = this.http.patch(`${this.apiUrl}/read-all`, {});
    request.subscribe(() => this.fetchNotifications());
    return request;
  }

  clearAll(): Observable<any> {
    const request = this.http.delete(`${this.apiUrl}/clear`);
    request.subscribe(() => this.fetchNotifications());
    return request;
  }
}
