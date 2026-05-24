import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LeadService } from '../lead.service';
import { NotificationService } from '../notification.service';

@Component({
  selector: 'app-verify-employee',
  templateUrl: './verify-employee.component.html',
  styleUrls: ['./verify-employee.component.css']
})
export class VerifyEmployeeComponent implements OnInit {
  lead: any;
  isSubmitting = false;

  constructor(
    private leadService: LeadService, 
    private router: Router,
    private notificationService: NotificationService
  ) { }

  ngOnInit(): void {
    if (!localStorage.getItem('auth')) {
      this.router.navigate(['/login']);
      return;
    }

    this.lead = this.leadService.getTempLead();
    
    if (!this.lead) {
      this.router.navigate(['/add-employee']);
    }
  }

  edit() {
    this.router.navigate(['/add-employee']);
  }

  confirm() {
    this.isSubmitting = true;
    
    this.leadService.addLead(this.lead).subscribe({
      next: (res) => {
        if (res.success) {
          this.notificationService.showSuccess('Lead added successfully!');
          this.leadService.clearTempLead();
          
          setTimeout(() => {
            this.router.navigate(['/dashboard']);
          }, 500);
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        this.notificationService.showError(err.error?.message || 'Failed to add lead.');
      }
    });
  }
}
