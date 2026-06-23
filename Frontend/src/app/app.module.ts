import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginComponent } from './login/login.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { MenuComponent } from './menu/menu.component';
import { AddEmployeeComponent } from './add-employee/add-employee.component';
import { VerifyEmployeeComponent } from './verify-employee/verify-employee.component';
import { MainLayoutComponent } from './main-layout/main-layout.component';
import { OcrScannerComponent } from './ocr-scanner/ocr-scanner.component';
import { BillScannerComponent } from './bill-scanner/bill-scanner.component';
import { AnnotationToolComponent } from './annotation-tool/annotation-tool.component';
import { LeadAssistantWidgetComponent } from './lead-assistant-widget/lead-assistant-widget.component';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    DashboardComponent,
    MenuComponent,
    AddEmployeeComponent,
    VerifyEmployeeComponent,
    MainLayoutComponent,
    OcrScannerComponent,
    BillScannerComponent,
    AnnotationToolComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    DragDropModule,
    LeadAssistantWidgetComponent
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
