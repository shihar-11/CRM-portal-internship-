import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationService, Toast } from '../notification.service';
import { BellNotificationService, Notification } from '../services/bell-notification.service';
import { ProfileService, UserProfile } from '../services/profile.service';
import { Subscription } from 'rxjs';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

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
  private notifSub!: Subscription;
  private countSub!: Subscription;
  private profileSub!: Subscription;

  // Sidebar Menu State
  isEditMode = false;
  menuItems = [
    { link: '/dashboard', icon: 'fa-chart-pie', text: 'Dashboard', style: null },
    { link: '/ocr-scanner', icon: 'fa-file-invoice', text: 'OCR Scanner', style: null },
    { link: '/ocr-template-mapping', icon: 'fa-receipt', text: 'OCR Template Mapping', style: null },
    { link: '/annotation-tool', icon: 'fa-pencil', text: 'Annotation Tool', style: {'border-left': '3px solid transparent'} },
    { link: '/document-pipeline', icon: 'fa-network-wired', text: 'Doc Pipeline', style: {'border-left': '3px solid transparent'} }
  ];

  // UI State
  showNotificationDropdown = false;
  showProfileDropdown = false;
  showEditProfileModal = false;
  showChangePasswordModal = false;

  // Data State
  notifications: Notification[] = [];
  unreadCount = 0;
  profile: UserProfile | null = null;
  
  // Form State
  editProfileName = '';
  passwordData = { current: '', new: '', confirm: '' };
  passwordError = '';

  constructor(
    private router: Router, 
    private notificationService: NotificationService,
    private bellService: BellNotificationService,
    private profileService: ProfileService
  ) { }

  ngOnInit(): void {
    if (!localStorage.getItem('auth')) {
      this.router.navigate(['/login']);
    }

    const savedMenu = localStorage.getItem('sidebarMenuOrder');
    if (savedMenu) {
      try {
        this.menuItems = JSON.parse(savedMenu);
      } catch (e) {
        console.error('Failed to parse menu order', e);
      }
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

    this.notifSub = this.bellService.notifications$.subscribe(n => this.notifications = n);
    this.countSub = this.bellService.unreadCount$.subscribe(c => this.unreadCount = c);
    this.profileSub = this.profileService.profile$.subscribe(p => {
      this.profile = p;
      if (p) this.editProfileName = p.full_name;
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

  toggleEditMode() {
    this.isEditMode = !this.isEditMode;
  }

  drop(event: CdkDragDrop<string[]>) {
    moveItemInArray(this.menuItems, event.previousIndex, event.currentIndex);
    localStorage.setItem('sidebarMenuOrder', JSON.stringify(this.menuItems));
  }

  logout() {
    localStorage.removeItem('auth');
    this.router.navigate(['/login']);
  }

  removeToast(toast: Toast) {
    this.toasts = this.toasts.filter(t => t.id !== toast.id);
  }

  // --- Notification Methods ---
  toggleNotificationDropdown() {
    this.showNotificationDropdown = !this.showNotificationDropdown;
    if (this.showNotificationDropdown) this.showProfileDropdown = false;
  }

  markAsRead(id: number) {
    this.bellService.markAsRead(id);
  }

  markAllAsRead() {
    this.bellService.markAllAsRead();
  }

  clearAllNotifications() {
    this.bellService.clearAll();
  }

  // --- Profile Methods ---
  toggleProfileDropdown() {
    this.showProfileDropdown = !this.showProfileDropdown;
    if (this.showProfileDropdown) this.showNotificationDropdown = false;
  }

  openEditProfile() {
    this.showProfileDropdown = false;
    this.showEditProfileModal = true;
  }

  openChangePassword() {
    this.showProfileDropdown = false;
    this.showChangePasswordModal = true;
    this.passwordData = { current: '', new: '', confirm: '' };
    this.passwordError = '';
  }

  closeModals() {
    this.showEditProfileModal = false;
    this.showChangePasswordModal = false;
  }

  onImageSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.profileService.uploadImage(file).subscribe({
        next: () => this.notificationService.showSuccess('Profile picture updated'),
        error: (err) => this.notificationService.showError('Upload failed')
      });
    }
  }

  saveProfileName() {
    if (!this.editProfileName.trim()) return;
    this.profileService.updateName(this.editProfileName).subscribe({
      next: () => {
        this.notificationService.showSuccess('Name updated');
        this.closeModals();
      },
      error: () => this.notificationService.showError('Update failed')
    });
  }

  updatePassword() {
    if (this.passwordData.new !== this.passwordData.confirm) {
      this.passwordError = "New passwords don't match";
      return;
    }
    this.profileService.updatePassword(this.passwordData.current, this.passwordData.new).subscribe({
      next: () => {
        this.notificationService.showSuccess('Password updated successfully');
        this.closeModals();
      },
      error: (err) => {
        this.passwordError = err.error?.error || 'Update failed';
      }
    });
  }

  getInitials(name: string): string {
    if (!name) return 'A';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
}
