import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class BillScannerService {
  private apiUrl = 'http://localhost:3000/api/bill-scan';

  public cachedOrderData: any = null;
  public cachedStep: number = 1;
  public hasCachedState: boolean = false;

  constructor(private http: HttpClient) { }

  clearCache() {
    this.cachedOrderData = null;
    this.cachedStep = 1;
    this.hasCachedState = false;
  }

  scanDocument(file: File, annotations?: any[], documentType?: string): Observable<any> {
    const formData = new FormData();
    formData.append('document', file);
    if (annotations && annotations.length > 0) {
      formData.append('annotations', JSON.stringify(annotations));
    }
    if (documentType) {
      formData.append('document_type', documentType);
    }
    return this.http.post<any>(this.apiUrl, formData);
  }

  saveAnnotations(payload: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/save-annotation`, payload);
  }
}
