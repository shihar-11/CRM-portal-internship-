import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AppStateService {
  private cache: { [componentName: string]: any } = {};

  setComponentState(componentName: string, state: any) {
    this.cache[componentName] = state;
  }

  getComponentState(componentName: string): any {
    return this.cache[componentName];
  }

  hasComponentState(componentName: string): boolean {
    return !!this.cache[componentName];
  }

  clearComponentState(componentName: string) {
    delete this.cache[componentName];
  }
}
