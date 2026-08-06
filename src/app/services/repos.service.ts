import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Repo } from '../models/repo';
import { ScanResult } from '../models/scan-result';
import { map, of } from 'rxjs';

/**
 * REST client for repository CRUD and scan operations.
 * Endpoints: GET/POST/DELETE /repos, POST /repos/:id/scan.
 */
@Injectable({ providedIn: 'root' })
export class ReposService {
  private http = inject(HttpClient);
  private base = environment.apiBase;
  private stubs = environment.useStubs;

  private mapStubRepo(r: Record<string, unknown>): Repo {
    const stats = r['stats'] as { files?: number } | undefined;
    const name = stats?.files ? 'coupling-test' : 'unknown';
    return {
      id: r['repoId'] as string,
      name,
      fullName: name,
      codePath: r['codePath'] as string | undefined,
      scannedAt: r['scannedAt'] as string | undefined,
      stats: r['stats'] as Repo['stats'],
    };
  }

  getRepos() {
    if (this.stubs) {
      return this.http
        .get<{ repos?: unknown[] }>('/json/stub-data.json')
        .pipe(
          map((data) =>
            (data.repos ?? []).map((r) => this.mapStubRepo(r as Record<string, unknown>)),
          ),
        );
    }
    return this.http.get<Repo[]>(`${this.base}/repos`);
  }

  getRepo(id: string) {
    if (this.stubs) {
      return this.http
        .get<{ repos?: unknown[] }>('/json/stub-data.json')
        .pipe(
          map((data) =>
            this.mapStubRepo(
              (data.repos ?? []).find(
                (r) => (r as Record<string, unknown>)['repoId'] === id,
              ) as Record<string, unknown>,
            ),
          ),
        );
    }
    return this.http.get<Repo>(`${this.base}/repos/${id}`);
  }

  addRepo(gitUrl: string) {
    if (this.stubs) {
      return this.http
        .get<{ repos?: unknown[] }>('/json/stub-data.json')
        .pipe(map((data) => this.mapStubRepo((data.repos ?? [])[0] as Record<string, unknown>)));
    }
    return this.http.post<Repo>(`${this.base}/repos`, { gitUrl });
  }

  deleteRepo(id: string) {
    if (this.stubs) return of({ ok: true });
    return this.http.delete<{ ok: boolean }>(`${this.base}/repos/${id}`);
  }

  scanRepo(id: string) {
    if (this.stubs) {
      return this.http
        .get<{ repos?: unknown[] }>('/json/stub-data.json')
        .pipe(map((data) => (data.repos ?? [])[0] as ScanResult));
    }
    return this.http.post<ScanResult>(`${this.base}/repos/${id}/scan`, {});
  }
}
