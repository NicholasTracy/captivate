import { useEffect, useMemo, useState } from 'react'
import CloseIcon from '@mui/icons-material/Close'
import {
  AppBar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material'
import { FixtureType } from '../../shared/dmxFixtures'
import { parseFixtureLibrary } from '../../shared/fixtureLibrary'
import FixtureLibraryInfoButton from './FixtureLibraryInfoButton'
import { fixtureFileDisplayName } from '../../shared/captivateFixtureLibraryRemote'
import {
  invalidateFixtureLibraryIndex,
  loadFixtureLibraryIndex,
  type FixtureLibraryIndex,
  type FixtureSourceId,
} from './fixtureLibrarySources'

interface Props {
  open: boolean
  onClose: () => void
  onImportFixtures: (fixtures: FixtureType[]) => void
}

const fixtureSources: { id: FixtureSourceId; label: string }[] = [
  { id: 'captivate', label: 'Captivate Community Library' },
  { id: 'qlc', label: 'QLC+ Fixture Library' },
  { id: 'ofl', label: 'Open Fixture Library' },
]

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim().length > 0) {
    return err.message
  }
  return fallback
}

export default function QlcFixtureBrowserModal({
  open,
  onClose,
  onImportFixtures,
}: Props) {
  const [source, setSource] = useState<FixtureSourceId>('captivate')
  const [indexBySource, setIndexBySource] = useState<
    Partial<Record<FixtureSourceId, FixtureLibraryIndex>>
  >({})
  const [selectedManufacturerBySource, setSelectedManufacturerBySource] =
    useState<Partial<Record<FixtureSourceId, string>>>({})
  const [manufacturerSearch, setManufacturerSearch] = useState('')

  const [fixtureSearch, setFixtureSearch] = useState('')
  const [selectedFixturePath, setSelectedFixturePath] = useState('')

  const [isLoadingManufacturers, setIsLoadingManufacturers] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [message, setMessage] = useState('')

  const sourceIndex = indexBySource[source]
  const manufacturers = sourceIndex?.manufacturers ?? []
  const selectedManufacturer = selectedManufacturerBySource[source] ?? ''
  const selectedManufacturerOption = manufacturers.find(
    (manufacturer) => manufacturer.key === selectedManufacturer
  )
  // One index per source covers every manufacturer, so switching is instant.
  const fixturesForSelectedManufacturer =
    sourceIndex?.fixturesByManufacturer[selectedManufacturer] ?? []

  const selectedFixture = useMemo(
    () =>
      fixturesForSelectedManufacturer.find(
        (fixture) => fixture.path === selectedFixturePath
      ),
    [fixturesForSelectedManufacturer, selectedFixturePath]
  )

  const filteredManufacturers = useMemo(() => {
    const query = manufacturerSearch.trim().toLowerCase()
    if (query.length === 0) return manufacturers
    return manufacturers.filter((manufacturer) =>
      manufacturer.label.toLowerCase().includes(query)
    )
  }, [manufacturerSearch, manufacturers])

  const filteredFixtures = useMemo(() => {
    const query = fixtureSearch.trim().toLowerCase()
    if (query.length === 0) return fixturesForSelectedManufacturer
    return fixturesForSelectedManufacturer.filter((fixture) => {
      const displayName =
        source === 'captivate'
          ? fixtureFileDisplayName(fixture.name)
          : fixture.name
      return (
        displayName.toLowerCase().includes(query) ||
        fixture.name.toLowerCase().includes(query) ||
        fixture.path.toLowerCase().includes(query)
      )
    })
  }, [fixtureSearch, fixturesForSelectedManufacturer, source])

  const fixtureListLabel = source === 'captivate' ? 'Model' : 'Fixture File'
  const fixtureFilterPlaceholder =
    source === 'captivate' ? 'Filter by model name' : 'Filter fixture files'

  useEffect(() => {
    if (!open || sourceIndex !== undefined || isLoadingManufacturers) {
      return
    }

    void loadSourceIndex(source)
  }, [open, source, sourceIndex, isLoadingManufacturers])

  async function loadSourceIndex(sourceId: FixtureSourceId) {
    setIsLoadingManufacturers(true)
    setMessage('')

    try {
      const index = await loadFixtureLibraryIndex(sourceId)

      setIndexBySource((prev) => ({ ...prev, [sourceId]: index }))
      setSelectedManufacturerBySource((prev) => {
        const currentSelection = prev[sourceId]
        const selectionIsValid = index.manufacturers.some(
          (manufacturer) => manufacturer.key === currentSelection
        )
        return {
          ...prev,
          [sourceId]:
            selectionIsValid && currentSelection !== undefined
              ? currentSelection
              : index.manufacturers[0]?.key ?? '',
        }
      })
      if (index.warning !== undefined) {
        setMessage(index.warning)
      }
    } catch (err) {
      setMessage(
        `Failed to load fixture library: ${errorMessage(err, 'Unknown error.')}`
      )
    } finally {
      setIsLoadingManufacturers(false)
    }
  }

  async function importSelectedFixture() {
    if (selectedFixture === undefined) {
      setMessage('Select a fixture file to import.')
      return
    }

    setIsImporting(true)
    setMessage('')

    try {
      const response = await fetch(selectedFixture.downloadUrl)
      if (!response.ok) {
        throw new Error(`Fixture download failed (${response.status}).`)
      }

      const fixtureDefinition = await response.text()
      const importedFixtures = parseFixtureLibrary(fixtureDefinition).map(
        (fixture) => {
          if (
            source !== 'ofl' ||
            selectedManufacturerOption === undefined ||
            (typeof fixture.manufacturer === 'string' &&
              fixture.manufacturer.trim().length > 0 &&
              fixture.manufacturer.trim().toLowerCase() !== 'unknown')
          ) {
            return fixture
          }

          return {
            ...fixture,
            manufacturer: selectedManufacturerOption.label,
          }
        }
      )
      onImportFixtures(importedFixtures)
      onClose()
    } catch (err) {
      setMessage(`Import failed: ${errorMessage(err, 'Unknown error.')}`)
    } finally {
      setIsImporting(false)
    }
  }

  function handleManufacturerSelect(manufacturer: string) {
    setSelectedManufacturerBySource((prev) => ({
      ...prev,
      [source]: manufacturer,
    }))
    const fixtures = sourceIndex?.fixturesByManufacturer[manufacturer]
    setSelectedFixturePath(fixtures?.[0]?.path ?? '')
    setFixtureSearch('')
  }

  function handleSourceChange(event: SelectChangeEvent<string>) {
    const nextSource = event.target.value as FixtureSourceId
    setSource(nextSource)
    setSelectedFixturePath('')
    setManufacturerSearch('')
    setFixtureSearch('')
    setMessage('')
  }

  function refreshCurrentSource() {
    invalidateFixtureLibraryIndex(source)
    setIndexBySource((prev) => {
      const next = { ...prev }
      delete next[source]
      return next
    })
    setSelectedManufacturerBySource((prev) => {
      const next = { ...prev }
      delete next[source]
      return next
    })
    setSelectedFixturePath('')
    void loadSourceIndex(source)
  }

  const disableImport =
    isImporting ||
    selectedManufacturer.length === 0 ||
    selectedFixture === undefined

  return (
    <Dialog open={open} onClose={onClose} fullScreen>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Typography variant="h6" sx={{ flex: 1 }}>
            Search For Fixture Online
          </Typography>
          <FixtureLibraryInfoButton topic="search-online" searchSource={source} />
          <IconButton edge="end" onClick={onClose} aria-label="close">
            <CloseIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <DialogContent
        sx={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0 }}
      >
        <FormControl size="small" sx={{ maxWidth: 360 }}>
          <InputLabel id="fixture-online-source-label">Source</InputLabel>
          <Select
            labelId="fixture-online-source-label"
            value={source}
            label="Source"
            onChange={handleSourceChange}
          >
            {fixtureSources.map((sourceOption) => (
              <MenuItem key={sourceOption.id} value={sourceOption.id}>
                {sourceOption.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {message.length > 0 && (
          <Typography color="error" variant="body2">
            {message}
          </Typography>
        )}

        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: '1fr 2fr',
            minHeight: 0,
            flex: 1,
          }}
        >
          <Paper
            variant="outlined"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            <Box sx={{ p: 1 }}>
              <TextField
                fullWidth
                size="small"
                label="Manufacturer"
                value={manufacturerSearch}
                onChange={(event) => {
                  setManufacturerSearch(event.target.value)
                }}
                placeholder="Filter manufacturers"
              />
            </Box>
            <List dense sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {isLoadingManufacturers && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <CircularProgress size={22} />
                </Box>
              )}
              {!isLoadingManufacturers &&
                filteredManufacturers.map((manufacturer) => (
                  <ListItemButton
                    key={manufacturer.key}
                    selected={manufacturer.key === selectedManufacturer}
                    onClick={() => handleManufacturerSelect(manufacturer.key)}
                  >
                    <ListItemText primary={manufacturer.label} />
                  </ListItemButton>
                ))}
            </List>
          </Paper>

          <Paper
            variant="outlined"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            <Box sx={{ p: 1 }}>
              <TextField
                fullWidth
                size="small"
                label={fixtureListLabel}
                value={fixtureSearch}
                onChange={(event) => {
                  setFixtureSearch(event.target.value)
                }}
                placeholder={fixtureFilterPlaceholder}
                disabled={selectedManufacturer.length === 0}
              />
            </Box>
            <List dense sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {filteredFixtures.map((fixtureFile) => (
                <ListItemButton
                  key={fixtureFile.path}
                  selected={fixtureFile.path === selectedFixturePath}
                  onClick={() => {
                    setSelectedFixturePath(fixtureFile.path)
                  }}
                >
                  <ListItemText
                    primary={
                      source === 'captivate'
                        ? fixtureFileDisplayName(fixtureFile.name)
                        : fixtureFile.name
                    }
                    secondary={fixtureFile.path}
                  />
                </ListItemButton>
              ))}
            </List>
          </Paper>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button
          onClick={refreshCurrentSource}
          disabled={isLoadingManufacturers || isImporting}
        >
          Refresh
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} disabled={isImporting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void importSelectedFixture()}
          disabled={disableImport}
        >
          Import
        </Button>
      </DialogActions>
    </Dialog>
  )
}
