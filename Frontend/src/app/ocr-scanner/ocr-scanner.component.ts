import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { LeadService } from '../lead.service';
import { NotificationService } from '../notification.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-ocr-scanner',
  templateUrl: './ocr-scanner.component.html',
  styleUrls: ['./ocr-scanner.component.css']
})
export class OcrScannerComponent implements OnInit {
  isDragging = false;
  selectedFile: File | null = null;
  isExtracting = false;
  extractionComplete = false;

  leadData = {
    name: '',
    email: '',
    phone: '',
    university: '',
    degree: '',
    skills: ''
  };

  placeholders = {
    name: ' ',
    email: ' ',
    phone: ' ',
    university: ' ',
    degree: ' ',
    skills: ' '
  };

  constructor(
    private http: HttpClient,
    private leadService: LeadService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {}

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      this.handleFile(event.dataTransfer.files[0]);
    }
  }

  onFileSelected(event: any) {
    if (event.target.files && event.target.files.length > 0) {
      this.handleFile(event.target.files[0]);
    }
  }

  handleFile(file: File) {
    const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (validTypes.includes(file.type)) {
      this.selectedFile = file;
      this.extractionComplete = false;
    } else {
      alert('Invalid file type. Please upload a PDF, JPG, or PNG.');
    }
  }

  extractData() {
    if (!this.selectedFile) return;
    
    this.isExtracting = true;
    
    const formData = new FormData();
    formData.append('document', this.selectedFile);

    this.http.post<any>('http://localhost:3000/api/ocr/extract', formData).subscribe({
      next: (res) => {
        this.isExtracting = false;
        this.extractionComplete = true;
        
        // Reset placeholders
        this.placeholders = {
          name: ' ', email: ' ', phone: ' ', university: ' ', degree: ' ', skills: ' '
        };

        this.leadData.name = res.full_name || '';
        this.leadData.email = res.email || '';
        this.leadData.phone = res.phone || '';
        this.leadData.university = res.university || '';
        this.leadData.degree = res.degree || '';
        this.leadData.skills = res.skills || '';

        if (!res.full_name) this.placeholders.name = 'Not found in document';
        if (!res.email) this.placeholders.email = 'Not found in document';
        if (!res.phone) this.placeholders.phone = 'Not found in document';
        if (!res.university) this.placeholders.university = 'Not found in document';
        if (!res.degree) this.placeholders.degree = 'Not found in document';
        if (!res.skills) this.placeholders.skills = 'Not found in document';

        this.notificationService.showSuccess('Data extracted successfully!');
      },
      error: (err) => {
        this.isExtracting = false;
        this.notificationService.showError('Extraction failed. Check console for details.');
        console.error(err);
      }
    });
  }

  saveLead() {
    // Combine extra fields into notes, since database doesn't have dedicated columns
    const finalNotes = `Phone: ${this.leadData.phone} | Extracted via OCR.\nUniversity: ${this.leadData.university}\nDegree: ${this.leadData.degree}\nSkills: ${this.leadData.skills}`;
    
    const payload = {
      name: this.leadData.name,
      email: this.leadData.email,
      status: 'New',
      source: 'OCR Scanner',
      notes: finalNotes,
      department: 'General'
    };

    this.leadService.addLead(payload).subscribe({
      next: (res) => {
        this.notificationService.showSuccess('Lead saved successfully from OCR!');
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.notificationService.showError('Error saving lead.');
        console.error(err);
      }
    });
  }
}
