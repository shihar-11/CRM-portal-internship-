import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { AddEmployeeComponent } from './add-employee/add-employee.component';
import { VerifyEmployeeComponent } from './verify-employee/verify-employee.component';
import { MainLayoutComponent } from './main-layout/main-layout.component';
import { OcrScannerComponent } from './ocr-scanner/ocr-scanner.component';
import { BillScannerComponent } from './bill-scanner/bill-scanner.component';

const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { 
    path: '', 
    component: MainLayoutComponent,
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'add-employee', component: AddEmployeeComponent },
      { path: 'verify-employee', component: VerifyEmployeeComponent },
      { path: 'ocr-scanner', component: OcrScannerComponent },
      { path: 'ocr-template-mapping', component: BillScannerComponent }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
