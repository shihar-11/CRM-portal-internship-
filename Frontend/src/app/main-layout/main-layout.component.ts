import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationService, Toast } from '../notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-main-layout',
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.css']
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  isCollapsed = false;
  isDarkMode = false;
  currentTime = new Date();
  private timeInterval: any;
  
  toasts: Toast[] = [];
  private toastSub!: Subscription;

  constructor(private router: Router, private notificationService: NotificationService) { }

  ngOnInit(): void {
    if (!localStorage.getItem('auth')) {
      this.router.navigate(['/login']);
    }

    this.timeInterval = setInterval(() => {
      this.currentTime = new Date();
    }, 1000);

    this.toastSub = this.notificationService.toasts$.subscribe(toast => {
      this.toasts.push(toast);
      setTimeout(() => {
        this.removeToast(toast);
      }, 3000);
    });
  }

  ngOnDestroy() {
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
    }
    if (this.toastSub) {
      this.toastSub.unsubscribe();
    }
  }

  toggleSidebar() {
    this.isCollapsed = !this.isCollapsed;
  }

  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    if (this.isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }

  logout() {
    localStorage.removeItem('auth');
    this.router.navigate(['/login']);
  }

  removeToast(toast: Toast) {
    this.toasts = this.toasts.filter(t => t.id !== toast.id);
  }
}
