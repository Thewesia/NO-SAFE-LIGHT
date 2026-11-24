import { MissionStep } from '../types/game';

export class MissionManager {
  public step: MissionStep = 'FIND_FUSE';
  public bannerText: string | null = null;
  private bannerTimer = 0;

  public reset(): void {
    this.step = 'FIND_FUSE';
    this.bannerText = 'Blackout active. Search the Maintenance Depot for a 60A fuse.';
    this.bannerTimer = 5.0;
  }

  public setStep(next: MissionStep, banner?: string): void {
    this.step = next;
    if (banner) {
      this.bannerText = banner;
      this.bannerTimer = 5.0;
    }
  }

  public showBanner(text: string, duration = 3.8): void {
    this.bannerText = text;
    this.bannerTimer = duration;
  }

  public update(dt: number): void {
    if (this.bannerTimer > 0) {
      this.bannerTimer = Math.max(0, this.bannerTimer - dt);
      if (this.bannerTimer <= 0) {
        this.bannerText = null;
      }
    }
  }

  public getStepIndex(): number {
    switch (this.step) {
      case 'FIND_FUSE':
        return 1;
      case 'INSTALL_FUSE':
        return 2;
      case 'POWER_STATION':
        return 3;
      case 'REACH_EXTRACTION':
      case 'EXTRACTED':
        return 4;
    }
  }

  public getObjectiveText(): string {
    switch (this.step) {
      case 'FIND_FUSE':
        return 'Find the missing 60A fuse in the Maintenance Depot';
      case 'INSTALL_FUSE':
        return 'Install the fuse and start the East Substation Generator';
      case 'POWER_STATION':
        return 'Open the Emergency Station shutter and restore main relay power';
      case 'REACH_EXTRACTION':
        return 'Escape through the North Extraction Gate';
      case 'EXTRACTED':
        return 'Evacuation complete';
    }
  }
}
