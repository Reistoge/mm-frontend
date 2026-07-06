import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable, map } from 'rxjs';

/**
 * REST client for fetching individual metric data by repo and metric name.
 * Endpoint: GET /metrics/:repoId/:metricName.
 */
@Injectable({ providedIn: 'root' })
export class MetricsService {
  private http = inject(HttpClient);
  private base = environment.apiBase;
  private stubs = environment.useStubs;

  getMetric(repoId: string, metricName: string): Observable<unknown> {
    if (this.stubs) {
      return this.http.get<{ repos?: unknown[] }>('/json/stub-data.json').pipe(
        map((data) => {
          const first = (data.repos ?? [])[0] as Record<string, unknown> | undefined;
          const metrics = first?.['modularityMetrics'] as Record<string, unknown> | undefined;
          return metrics?.[metricName];
        }),
      );
    }
    return this.http.get<unknown>(`${this.base}/metrics/${repoId}/${metricName}`);
  }
}
