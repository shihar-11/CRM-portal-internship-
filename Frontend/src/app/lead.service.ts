import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LeadService {
  private apiUrl = 'http://localhost:3000/api';
  private tempLeadData: any = null;

  private openLeadModalSource = new Subject<any>();
  openLeadModal$ = this.openLeadModalSource.asObservable();

  constructor(private http: HttpClient) { }

  login(data: any): Observable<any> {
  return this.http.post(`${this.apiUrl}/auth/login`, data);
  }

  getLeads(): Observable<any> {
    return this.http.get(`${this.apiUrl}/leads`);
  }

  getHotLeads(limit: number = 5): Observable<any> {
    return this.http.get(`${this.apiUrl}/leads/hot?limit=${limit}`);
  }

  queryChatbot(message: string, history: any[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/chatbot/query`, { message, history });
  }

  addLead(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/leads`, data);
  }

  updateLead(id: number | string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/leads/${id}`, data);
  }

  deleteLead(id: number | string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/leads/${id}`);
  }

  setTempLead(data: any) {
    this.tempLeadData = data;
  }

  getTempLead() {
    return this.tempLeadData;
  }

  clearTempLead() {
    this.tempLeadData = null;
  }

  triggerOpenLeadModal(lead: any) {
    this.openLeadModalSource.next(lead);
  }
}
