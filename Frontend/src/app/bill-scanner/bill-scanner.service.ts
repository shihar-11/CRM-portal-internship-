import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class BillScannerService {
  private apiUrl = 'http://localhost:3000/api/bill-scan';

  constructor(private http: HttpClient) { }

  scanDocument(file: File, annotations?: any[]): Observable<any> {
    const formData = new FormData();
    formData.append('document', file);
    if (annotations && annotations.length > 0) {
      formData.append('annotations', JSON.stringify(annotations));
    }
    return this.http.post<any>(this.apiUrl, formData);
  }

  saveAnnotations(payload: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/save-annotation`, payload);
  }
}
