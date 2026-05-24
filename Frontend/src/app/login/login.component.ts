import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { LeadService } from '../lead.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  username = '';
  password = '';
  errorMessage = '';

  constructor(private leadService: LeadService, private router: Router) {}

  login() {
    this.leadService.login({ username: this.username, password: this.password }).subscribe({
      next: (res) => {
        if (res.success) {
          localStorage.setItem('auth', 'true');
          this.router.navigate(['/dashboard']);
        }
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Invalid credentials';
      }
    });
  }
}
