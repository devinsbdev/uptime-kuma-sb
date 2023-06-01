<template>
    <div>
        <div class="my-4">
            <label for="keepDataPeriodDays" class="form-label">
                {{
                    $t("clearDataOlderThan", [
                        settings.keepDataPeriodDays,
                    ])
                }}
                {{ $t("infiniteRetention") }}
            </label>
            <input
                id="keepDataPeriodDays"
                v-model="settings.keepDataPeriodDays"
                type="number"
                class="form-control"
                required
                min="0"
                step="1"
            />
            <div v-if="settings.keepDataPeriodDays < 0" class="form-text">
                {{ $t("dataRetentionTimeError") }}
            </div>
        </div>
        <div class="my-1">
            <button class="btn btn-primary" type="button" style="margin-bottom: 25px;" @click="saveSettings()">
                {{ $t("Save") }}
            </button>
        </div>
        <div class="my-4">
            <div class="settings-content">
                <div class="settings-content-header">
                    Database <span style="font-size: medium; opacity: 0.75;">[ {{ databaseInfoDisplay }} ]</span>
                </div>
            </div>
            <div class="my-3">
                <button class="btn btn-outline-info me-2" @click="shrinkDatabase">
                    {{ $t("Shrink Database") }} ({{ databaseSizeDisplay }})
                </button>
                <div class="form-text mt-2 mb-4 ms-2">{{ $t("shrinkDatabaseDescription") }}</div>
            </div>
            <button
                id="clearAllStats-btn"
                class="btn btn-outline-danger me-2 mb-2"
                @click="confirmClearStatistics"
            >
                {{ $t("Clear all statistics") }}
            </button>
        </div>
        <Confirm
            ref="confirmClearStatistics"
            btn-style="btn-danger"
            :yes-text="$t('I need this done yesterday!')"
            :no-text="$t('Nevermind.')"
            :title="$t('Uh, yeah.. sure. Can we talk first?')"
            @yes="clearStatistics"
        >
            {{ $t("confirmClearStatisticsMsg") }}
        </Confirm>
    </div>
</template>

<script>
import Confirm from "../../components/Confirm.vue";
import { log } from "../../util.ts";
import { useToast } from "vue-toastification";

const toast = useToast();

export default {
    components: {
        Confirm,
    },

    data() {
        return {
            databaseSize: 0,
            databaseInfo: 'NotFound'
        };
    },

    computed: {
        settings() {
            return this.$parent.$parent.$parent.settings;
        },
        saveSettings() {
            return this.$parent.$parent.$parent.saveSettings;
        },
        settingsLoaded() {
            return this.$parent.$parent.$parent.settingsLoaded;
        },
        databaseSizeDisplay() {
            return this.databaseSize;
        },
        databaseInfoDisplay() {
            return this.databaseInfo;
        }
        // databaseNameDisplay() {
        //     return Database.dbName;
        // }
    },

    async mounted() {
        this.loadDatabaseSize();
        this.loadDatabaseInfo();
    },

    methods: {
        /** Get the current size of the database */
        async loadDatabaseSize() {
            log.debug("monitorhistory", "load database size");
            await this.$root.getSocket().emit("getDatabaseSize", (res) => {
                if (res.ok) {
                    this.databaseSize = res.size;
                    log.debug("monitorhistory", "database size: " + res.size);
                } else {
                    log.debug("monitorhistory", res);
                }
            });
        },

        /** Get the current database type and version. */
        async loadDatabaseInfo() {
            log.debug("monitorhistory", "load database info");
            await this.$root.getSocket().emit("getDatabaseInfo", (res) => {
                if (res.ok) {
                    this.databaseInfo = res.info;
                    log.debug("monitorhistory", "databse info:" + res.info);
                } else {
                    log.debug("monitorhistory", res);
                }
            });
        },

        // async loadDatabaseName() {
        //     log.debug("monitorhistory", "load database name");
        //     log.debug("monitorhistory", "db name: " + Database.dbName);
        //     return Database.dbName;
        // },

        /** Request that the database is shrunk */
        shrinkDatabase() {
            this.$root.getSocket().emit("shrinkDatabase", (res) => {
                if (res.ok) {
                    this.loadDatabaseSize();
                    toast.success("Done");
                } else {
                    log.debug("monitorhistory", res);
                }
            });
        },

        /** Show the dialog to confirm clearing stats */
        confirmClearStatistics() {
            this.$refs.confirmClearStatistics.show();
        },

        /** Send the request to clear stats */
        clearStatistics() {
            this.$root.clearStatistics((res) => {
                if (res.ok) {
                    this.$router.go();
                } else {
                    toast.error(res.msg);
                }
            });
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../../assets/vars.scss";

.settings-content {
    .settings-content-header {
        width: calc(100% + 20px);
        border-bottom: 1px solid #dee2e6;
        border-radius: 0 10px 0 0;
        margin-top: -20px;
        margin-right: -20px;
        padding: 12.5px 1em;
        font-size: 26px;

        .dark & {
            background: $dark-header-bg;
            border-bottom: 0;
        }

        .mobile & {
            padding: 15px 0 0 0;

            .dark & {
                background-color: transparent;
            }
        }
    }
}
</style>
