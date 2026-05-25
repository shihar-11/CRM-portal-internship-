import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface UserProfile {
  id: number;
  username: string;
  full_name: string;
  profile_image: string | null;
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProfileService {
  private apiUrl = 'http://localhost:3000/api/profile';
  
  private profileSubject = new BehaviorSubject<UserProfile | null>(null);
  public profile$ = this.profileSubject.asObservable();

  constructor(private http: HttpClient) {
    this.fetchProfile();
  }

  fetchProfile() {
    this.http.get<UserProfile>(this.apiUrl).subscribe({
      next: (profile) => this.profileSubject.next(profile),
      error: (err) => console.error('Failed to fetch profile', err)
    });
  }

  updateName(fullName: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/name`, { full_name: fullName }).pipe(
      tap(() => this.fetchProfile())
    );
  }

  updatePassword(currentPassword: string, newPassword: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/password`, { 
      current_password: currentPassword, 
      new_password: newPassword 
    });
  }

  uploadImage(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('image', file);
    return this.http.post(`${this.apiUrl}/image`, formData).pipe(
      tap(() => this.fetchProfile())
    );
  }
}
